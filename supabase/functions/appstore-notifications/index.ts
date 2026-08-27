// supabase/functions/appstore-notifications/index.ts
//
// Webhook de App Store Server Notifications V2.
//
// Esta é a peça que faz a renovação automática aparecer no nosso banco SEM
// depender do app. A Apple chama esta URL quando uma assinatura renova, falha a
// cobrança, é cancelada ou estornada. O celular do usuário não participa — por
// isso funciona com o build que já está publicado, sem submeter versão nova.
//
// DECISÃO DE SEGURANÇA
//
// O payload vem assinado (JWS) com cadeia de certificados x5c. Em vez de
// verificar essa cadeia à mão (trabalhoso e fácil de errar em silêncio),
// tratamos a notificação como GATILHO NÃO CONFIÁVEL: extraímos só o
// originalTransactionId e então perguntamos à App Store Server API qual é o
// estado real. Essa consulta é autenticada com a nossa chave privada.
//
// Consequência: uma notificação forjada não injeta plano nenhum. O máximo que
// consegue é nos fazer reconsultar a Apple sobre uma assinatura verdadeira.
//
// CONFIGURAR em App Store Connect > seu app > General > App Information >
// App Store Server Notifications: versão V2, URL de produção E de sandbox.
// Implantar com --no-verify-jwt: quem chama é a Apple, que não tem JWT nosso.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  createAdminClient,
  persistState,
  EXPECTED_BUNDLE_ID,
  corsHeaders,
  jsonResponse,
} from '../_shared/subscription.ts'
import {
  decodeSignedPayload,
  getSubscriptionState,
  originalTransactionIdOf,
} from '../_shared/appleServerApi.ts'

// Notificações que mudam o direito de acesso. As demais (ex.: mudança de preço
// pendente) são registradas e ignoradas.
const ACTIONABLE = new Set([
  'DID_RENEW',                 // renovou — o caso que estava sendo perdido
  'DID_FAIL_TO_RENEW',         // cobrança falhou; pode entrar em período de graça
  'EXPIRED',
  'DID_CHANGE_RENEWAL_STATUS', // ligou/desligou renovação automática
  'GRACE_PERIOD_EXPIRED',
  'SUBSCRIBED',
  'DID_CHANGE_RENEWAL_PREF',   // troca de plano
  'REFUND',                    // estorno — acesso cai na hora
  'REVOKE',
  'RENEWAL_EXTENDED',
])

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const signedPayload = body?.signedPayload

    if (!signedPayload) {
      return jsonResponse({ error: 'signedPayload ausente' }, 400)
    }

    const payload = decodeSignedPayload(signedPayload)
    const notificationType = payload?.notificationType
    const subtype = payload?.subtype
    const data = payload?.data ?? {}

    console.log(`Notificação da Apple: ${notificationType}${subtype ? ` / ${subtype}` : ''}`)

    if (data.bundleId && data.bundleId !== EXPECTED_BUNDLE_ID) {
      console.warn(`Notificação de outro bundle (${data.bundleId}), ignorando`)
      return jsonResponse({ received: true, ignored: 'bundle diferente' })
    }

    // TEST é a notificação de validação disparada por nós (via
    // backfill-subscriptions {"testNotification":true}). Não carrega transação
    // nenhuma; chegar até aqui já prova que a cadeia inteira está de pé.
    if (notificationType === 'TEST') {
      console.log('Notificação TEST recebida com sucesso — webhook operacional.')
      const admin = createAdminClient()
      await admin.from('apple_notifications').insert({
        notification_type: 'TEST',
        payload,
      })
      return jsonResponse({ received: true, notificationType: 'TEST' })
    }

    if (!ACTIONABLE.has(notificationType)) {
      // 200 para a Apple não reenviar: recebemos, só não há o que fazer.
      return jsonResponse({ received: true, ignored: notificationType })
    }

    const originalTransactionId = originalTransactionIdOf(payload)

    if (!originalTransactionId) {
      console.warn('Notificação sem originalTransactionId, nada a fazer')
      return jsonResponse({ received: true, ignored: 'sem originalTransactionId' })
    }

    const admin = createAdminClient()

    // Dados da transação para o log. Falha aqui não pode derrubar a notificação.
    let tx: any = null
    try {
      if (data.signedTransactionInfo) {
        tx = decodeSignedPayload(data.signedTransactionInfo)
      }
    } catch (err) {
      console.warn('signedTransactionInfo ilegível:', err)
    }

    const { data: profiles, error } = await admin
      .from('profiles')
      .select('id')
      .eq('subscription_original_transaction_id', originalTransactionId)
      .limit(1)

    if (error) {
      console.error('Erro ao buscar perfil:', error)
      return jsonResponse({ error: 'Erro ao buscar perfil' }, 500)
    }

    const matchedUserId = profiles?.[0]?.id ?? null

    // Registramos ANTES de processar. Se a consulta à Apple falhar logo abaixo,
    // o originalTransactionId já ficou salvo — e é ele que permite mapear um
    // assinante que ainda não conhecemos.
    const { error: logError } = await admin.from('apple_notifications').insert({
      notification_type: notificationType,
      subtype: subtype ?? null,
      original_transaction_id: originalTransactionId,
      product_id: tx?.productId ?? null,
      expires_date: tx?.expiresDate ? new Date(Number(tx.expiresDate)).toISOString() : null,
      environment: tx?.environment ?? data.environment ?? null,
      matched_user_id: matchedUserId,
      payload,
    })

    // Falha ao registrar não pode abortar o processamento: perder a atualização
    // de plano é bem pior do que perder uma linha de auditoria.
    if (logError) {
      console.error('Falha ao registrar notificação (seguindo mesmo assim):', logError.message)
    }

    if (!matchedUserId) {
      // Esperado enquanto os assinantes antigos não estiverem mapeados: o build
      // publicado nunca gravou originalTransactionId. O ID acabou de ser salvo
      // em apple_notifications — associe com backfill-subscriptions {"assign":[...]}.
      //
      // 200 de propósito: se devolvêssemos 500, a Apple reenviaria esta
      // notificação por dias sem que o resultado mudasse.
      console.warn(
        `Nenhum perfil mapeado para originalTransactionId ${originalTransactionId}. ` +
        `ID registrado em apple_notifications; associe via backfill-subscriptions.`
      )
      return jsonResponse({
        received: true,
        ignored: 'usuário não mapeado',
        originalTransactionId,
      })
    }

    const userId = matchedUserId

    // Não acreditamos no que a notificação diz que aconteceu: perguntamos à
    // Apple qual é o estado real e gravamos isso.
    const state = await getSubscriptionState(originalTransactionId)
    await persistState(admin, userId, state)

    console.log(`[${userId}] ${notificationType} processada: ${state.reason}`)

    return jsonResponse({
      received: true,
      notificationType,
      userId,
      plan: state.plan,
      expiresAt: state.expiresAt,
    })

  } catch (error) {
    // 500 faz a Apple reenviar. É o que queremos numa falha transitória:
    // melhor reprocessar do que perder um evento de renovação.
    console.error('Erro ao processar notificação da Apple:', error)
    return jsonResponse(
      { error: 'Erro ao processar notificação', details: String(error?.message ?? error) },
      500
    )
  }
})
