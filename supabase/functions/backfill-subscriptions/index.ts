// supabase/functions/backfill-subscriptions/index.ts
//
// Descobre quem são os assinantes reais na Apple e associa cada um ao perfil
// certo no Supabase.
//
// O PROBLEMA QUE ELA RESOLVE
//
// O webhook precisa saber a qual usuário pertence um originalTransactionId. Esse
// vínculo normalmente é criado no ato da compra, pelo campo `appAccountToken`
// que o app manda para a Apple — e o build publicado nunca mandou. Resultado: a
// Apple sabe que existe um assinante, nós sabemos que existe um perfil premium,
// e nada liga os dois.
//
// A Apple não expõe nenhum dado pessoal na transação (nem e-mail, nem nada),
// então a associação NÃO tem como ser automática. O que esta função faz é
// reduzir o trabalho a uma decisão informada:
//
//   MODO DESCOBERTA (padrão, não escreve nada)
//     Lê o histórico de notificações dos últimos 180 dias, monta a lista de
//     assinaturas reais com plano, datas e status, e mostra ao lado os perfis
//     pagos do banco. Com um assinante só, a associação é evidente.
//
//   MODO ASSOCIAÇÃO  { "assign": [{ "userId": "...", "originalTransactionId": "..." }] }
//     Grava o vínculo e sincroniza o estado real da Apple para aquele perfil.
//     A partir daí o webhook cuida sozinho de toda renovação futura.
//
// Chamada apenas com a service_role key. Não é para ser exposta ao app.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  createAdminClient,
  persistState,
  corsHeaders,
  jsonResponse,
} from '../_shared/subscription.ts'
import {
  getNotificationHistory,
  getSubscriptionState,
  originalTransactionIdOf,
  requestTestNotification,
  getTestNotificationStatus,
  lookupOrderId,
} from '../_shared/appleServerApi.ts'

/** Espera sem usar timers longos, que a Edge Function pode cortar. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Comparamos com a service_role diretamente em vez de confiar na verificação
  // de JWT do gateway, para a proteção não sumir num deploy com --no-verify-jwt.
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const provided = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!serviceRoleKey || provided !== serviceRoleKey) {
    return jsonResponse({ error: 'Não autorizado' }, 401)
  }

  try {
    const admin = createAdminClient()

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      // Corpo vazio = modo descoberta.
    }

    // ---- MODO TESTE DE WEBHOOK  { "testNotification": true } ----------------
    //
    // Valida a cadeia inteira sem esperar uma renovação real: nossas
    // credenciais, a URL cadastrada no App Store Connect e a nossa função
    // respondendo. A Apple dispara a notificação e devolve o resultado da
    // entrega — incluindo o erro, quando falha.
    if (body?.testNotification === true) {
      const token = await requestTestNotification()

      // A entrega não é instantânea. Consultamos algumas vezes antes de desistir.
      let status: any = null
      for (let attempt = 0; attempt < 6; attempt++) {
        await sleep(2000)
        try {
          status = await getTestNotificationStatus(token)
          if (status?.sendAttempts?.length > 0) break
        } catch (err) {
          // 404 enquanto a Apple ainda não registrou o resultado é normal.
          status = { pending: String(err?.message ?? err) }
        }
      }

      return jsonResponse({
        mode: 'testNotification',
        testNotificationToken: token,
        result: status,
        hint: 'sendAttempts[].sendAttemptResult === "SUCCESS" significa que a Apple entregou na nossa URL.',
      })
    }

    // ---- MODO ORDER ID  { "orderId": "MT1DZ7801X" } -------------------------
    //
    // O Order ID vem no e-mail de recibo que a Apple manda ao cliente. É a saída
    // para assinantes que compraram antes de existir qualquer rastreio nosso:
    // o cliente encaminha o recibo e o Order ID revela a transação.
    if (body?.orderId) {
      const lookup = await lookupOrderId(String(body.orderId))
      return jsonResponse({
        mode: 'orderId',
        orderId: body.orderId,
        appleStatus: lookup.status,
        appleStatusMeaning: lookup.status === 0 ? 'Order ID válido' : 'Order ID inválido ou desconhecido',
        transactions: lookup.transactions.map((tx: any) => ({
          originalTransactionId: tx.originalTransactionId,
          transactionId: tx.transactionId,
          productId: tx.productId,
          purchaseDate: tx.purchaseDate ? new Date(Number(tx.purchaseDate)).toISOString() : null,
          expiresDate: tx.expiresDate ? new Date(Number(tx.expiresDate)).toISOString() : null,
          environment: tx.environment,
        })),
      })
    }

    // ---- MODO ASSOCIAÇÃO ----------------------------------------------------
    if (Array.isArray(body?.assign) && body.assign.length > 0) {
      const results: any[] = []

      for (const item of body.assign) {
        const { userId, originalTransactionId } = item ?? {}

        if (!userId || !originalTransactionId) {
          results.push({ ...item, ok: false, error: 'userId e originalTransactionId são obrigatórios' })
          continue
        }

        try {
          // Consulta a Apple ANTES de gravar: se o ID não corresponder a uma
          // assinatura nossa, não queremos deixar um vínculo morto no banco.
          const state = await getSubscriptionState(originalTransactionId)

          await admin
            .from('profiles')
            .update({ subscription_original_transaction_id: originalTransactionId })
            .eq('id', userId)

          await persistState(admin, userId, state)

          // Fecha o laço: notificações antigas desse assinante deixam de
          // aparecer como órfãs na próxima descoberta.
          await admin
            .from('apple_notifications')
            .update({ matched_user_id: userId })
            .eq('original_transaction_id', originalTransactionId)
            .is('matched_user_id', null)

          results.push({
            userId,
            originalTransactionId,
            ok: true,
            plan: state.plan,
            status: state.status,
            expiresAt: state.expiresAt,
            reason: state.reason,
          })
          console.log(`[${userId}] associado a ${originalTransactionId}: ${state.reason}`)
        } catch (err) {
          results.push({
            userId,
            originalTransactionId,
            ok: false,
            error: String(err?.message ?? err),
          })
        }
      }

      return jsonResponse({ mode: 'assign', results })
    }

    // ---- MODO DESCOBERTA ----------------------------------------------------
    const daysBack = Number(body?.daysBack ?? 180)

    // Duas fontes de originalTransactionId, porque nenhuma sozinha basta:
    //
    //  1. Histórico da Apple — só existe para notificações que ela TENTOU
    //     entregar. Fica vazio enquanto a URL do webhook nunca esteve cadastrada.
    //  2. Nosso log local — pega tudo que chegou desde que o webhook subiu,
    //     inclusive de assinantes que ainda não sabemos quem são.
    const history = await getNotificationHistory(daysBack)

    const byId = new Map<string, { types: Set<string>; count: number; source: Set<string> }>()

    const track = (id: string | null, type: string, source: string) => {
      if (!id) return
      const entry = byId.get(id) ?? { types: new Set<string>(), count: 0, source: new Set<string>() }
      entry.types.add(type)
      entry.source.add(source)
      entry.count++
      byId.set(id, entry)
    }

    for (const payload of history) {
      track(originalTransactionIdOf(payload), payload?.notificationType ?? 'DESCONHECIDO', 'apple')
    }

    const { data: logged } = await admin
      .from('apple_notifications')
      .select('original_transaction_id, notification_type, matched_user_id')
      .is('matched_user_id', null)
      .not('original_transaction_id', 'is', null)
      .order('received_at', { ascending: false })
      .limit(500)

    for (const row of logged ?? []) {
      track(row.original_transaction_id, row.notification_type ?? 'DESCONHECIDO', 'log-local')
    }

    const subscriptions: any[] = []
    for (const [originalTransactionId, meta] of byId) {
      try {
        const state = await getSubscriptionState(originalTransactionId)
        subscriptions.push({
          originalTransactionId,
          plan: state.plan,
          status: state.status,
          expiresAt: state.expiresAt,
          autoRenew: state.autoRenew,
          productId: state.productId,
          environment: state.environment,
          notificationTypes: [...meta.types],
          notificationCount: meta.count,
          descobertoVia: [...meta.source],
          reason: state.reason,
        })
      } catch (err) {
        subscriptions.push({
          originalTransactionId,
          error: String(err?.message ?? err),
          notificationTypes: [...meta.types],
          descobertoVia: [...meta.source],
        })
      }
    }

    // Perfis pagos do banco, para comparar lado a lado.
    const { data: paidProfiles } = await admin
      .from('profiles')
      .select('id, subscription_plan, subscription_status, subscription_started_at, subscription_expires_at, subscription_original_transaction_id')
      .in('subscription_plan', ['basic', 'premium'])

    return jsonResponse({
      mode: 'discovery',
      daysBack,
      notificationsRead: history.length,
      subscriptionsFound: subscriptions.length,
      subscriptions,
      paidProfiles: paidProfiles ?? [],
      hint: 'Confira qual perfil corresponde a qual assinatura e chame de novo com {"assign":[{"userId":"...","originalTransactionId":"..."}]}',
    })

  } catch (error) {
    console.error('Erro no backfill:', error)
    return jsonResponse(
      { error: 'Erro no backfill', details: String(error?.message ?? error) },
      500
    )
  }
})
