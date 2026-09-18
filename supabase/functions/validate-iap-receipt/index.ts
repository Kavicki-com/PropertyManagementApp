// supabase/functions/validate-iap-receipt/index.ts
//
// Chamada pelo app depois de uma compra, na restauração de compras e quando a
// tela de assinatura abre. Pergunta o estado à Apple e grava o plano.
//
// Esta função é a ÚNICA forma de um usuário ganhar um plano pago. O app não
// escreve subscription_plan diretamente.
//
// MIGRAÇÃO DE 18/09/2026 — de recibo para transactionId.
//
// A versão anterior recebia um recibo base64 e chamava `verifyReceipt`, que a
// Apple depreciou. Ela também nunca serviu para nada na prática: o build que
// está na loja jamais capturou recibo, então essa função só tinha como validar
// quem ainda não existia.
//
// Com o app em StoreKit 2 (`expo-iap`), a compra já vem com um transactionId
// verificado pelo dispositivo. Agora é isso que chega aqui, e a consulta vai
// pela App Store Server API — o mesmo caminho que `revalidate-subscriptions` e
// `appstore-notifications` já usam. Um caminho só, não depreciado, e o vínculo
// `subscription_original_transaction_id` passa a ser gravado já na compra.
//
// Corpo aceito:
//   { "transactionId": "..." }  → consulta a Apple por essa transação
//   {}                          → revalida o vínculo já guardado no perfil

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  createAdminClient,
  persistState,
  corsHeaders,
  jsonResponse,
} from '../_shared/subscription.ts'
import {
  getSubscriptionState,
  AppleServerApiError,
} from '../_shared/appleServerApi.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const admin = createAdminClient()

    // O usuário é quem o token diz que é. Antes o userId vinha no corpo da
    // requisição, o que permitiria creditar plano na conta de outra pessoa.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Token de autorização não fornecido' }, 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await admin.auth.getUser(token)

    if (authError || !user) {
      return jsonResponse({ error: 'Usuário não autenticado ou token inválido' }, 401)
    }

    // transactionId é opcional: sem ele revalidamos o vínculo já guardado no
    // perfil, que é como a tela de assinatura confere renovação sem pedir nada
    // ao iOS (nenhum diálogo de senha).
    let transactionId: string | null = null
    try {
      const body = await req.json()
      transactionId = body?.transactionId ?? null
    } catch {
      // Corpo vazio é uso legítimo: "revalide o que você já tem sobre mim".
    }

    if (!transactionId) {
      const { data: profile } = await admin
        .from('profiles')
        .select('subscription_original_transaction_id')
        .eq('id', user.id)
        .single()

      transactionId = profile?.subscription_original_transaction_id ?? null

      if (!transactionId) {
        // Sem vínculo não há o que perguntar à Apple. Pode ser uma cortesia
        // concedida na mão ou uma assinatura anterior a este sistema. Em
        // nenhum dos dois casos rebaixamos alguém por conta própria: a tela
        // oferece "Restaurar compras", que traz o transactionId.
        return jsonResponse({
          error: 'Nenhuma assinatura vinculada a esta conta. Use "Restaurar compras".',
        }, 404)
      }
    }

    const state = await getSubscriptionState(transactionId)

    // Uma transação pertence a UMA conta por vez. Sem nenhuma guarda, alguém
    // poderia mandar o transactionId de outra pessoa (eles circulam em e-mails
    // de recibo) e receber o plano dela.
    //
    // Mas recusar sempre pega gente honesta: quem apaga a conta e cria outra,
    // ou uma família com um Apple ID só. Essa pessoa pagaria e ouviria que a
    // assinatura é de outro, sem saída.
    //
    // O meio-termo: o vínculo é transferível, desde que quem o detém NÃO tenha
    // acesso pago valendo. Quem está pagando não perde a assinatura para
    // ninguém; um perfil já expirado ou grátis solta o vínculo.
    if (state.originalTransactionId) {
      const { data: holders } = await admin
        .from('profiles')
        .select('id, subscription_plan, subscription_expires_at, subscription_grace_period_ends_at')
        .eq('subscription_original_transaction_id', state.originalTransactionId)
        .neq('id', user.id)

      const now = Date.now()

      // Cortesia concedida na mão tem plano pago e expires_at NULL. Ela não
      // deveria ter vínculo (o cron a ignora de propósito), mas se tiver,
      // tratamos como acesso valendo em vez de arriscar tirá-lo de alguém.
      const stillEntitled = (h: Record<string, any>) => {
        if (!h.subscription_plan || h.subscription_plan === 'free') return false
        if (!h.subscription_expires_at) return true
        const until = Math.max(
          new Date(h.subscription_expires_at).getTime(),
          h.subscription_grace_period_ends_at
            ? new Date(h.subscription_grace_period_ends_at).getTime()
            : 0
        )
        return until > now
      }

      const blocking = (holders ?? []).filter(stillEntitled)

      if (blocking.length > 0) {
        console.warn(
          `Transação ${state.originalTransactionId} pertence a ${blocking.map((h) => h.id).join(', ')} ` +
          `com acesso ativo; recusada para ${user.id}`
        )
        return jsonResponse({
          error: 'Esta assinatura já está ativa em outra conta. Entre com ela, '
            + 'ou cancele lá antes de assinar aqui.',
        }, 409)
      }

      // Ninguém está usando: o vínculo muda de dono. Precisa ser limpo no
      // perfil antigo — duas linhas com o mesmo originalTransactionId fariam o
      // webhook e o cron escolherem uma delas sem critério.
      for (const previous of holders ?? []) {
        const { error: releaseError } = await admin
          .from('profiles')
          .update({
            subscription_plan: 'free',
            subscription_status: 'active',
            subscription_expires_at: null,
            subscription_grace_period_ends_at: null,
            subscription_auto_renew: false,
            subscription_original_transaction_id: null,
            subscription_iap_transaction_id: null,
          })
          .eq('id', previous.id)

        if (releaseError) {
          console.error(`Falha ao soltar o vínculo de ${previous.id}:`, releaseError.message)
          return jsonResponse({
            error: 'Não foi possível transferir a assinatura agora. Tente novamente.',
          }, 500)
        }

        console.log(
          `Transação ${state.originalTransactionId} transferida de ${previous.id} ` +
          `para ${user.id} (perfil anterior sem acesso pago valendo)`
        )
      }
    }

    await persistState(admin, user.id, state)

    return jsonResponse({
      success: true,
      plan: state.plan,
      status: state.status,
      expiresAt: state.expiresAt,
      gracePeriodEndsAt: state.gracePeriodEndsAt,
      autoRenew: state.autoRenew,
      productId: state.productId,
      environment: state.environment,
      reason: state.reason,
    })

  } catch (error) {
    if (error instanceof AppleServerApiError) {
      console.error('Consulta à App Store Server API falhou:', error.message)
      return jsonResponse({ error: error.message }, 400)
    }

    console.error('Erro inesperado ao validar assinatura:', error)
    return jsonResponse(
      { error: 'Erro interno ao validar assinatura', details: String(error?.message ?? error) },
      500
    )
  }
})
