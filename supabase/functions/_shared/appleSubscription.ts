// supabase/functions/_shared/appleSubscription.ts
//
// Fonte da verdade sobre assinaturas. Todas as Edge Functions relacionadas a IAP
// passam por aqui, para que exista UM lugar decidindo o que é um plano ativo.
//
// Por que recibo em vez de cálculo local: o app antes fazia
// `expira = compra + 30 dias` no celular. Isso erra por três motivos —
// a Apple cobra por mês de calendário (não 30 dias), o app não fica sabendo de
// renovação, cancelamento ou reembolso, e qualquer um pode mentir. Mandando o
// recibo guardado para a Apple, ela devolve o estado atual de verdade.

// ATENÇÃO: verifyReceipt está DEPRECIADO pela Apple, e exige um recibo enviado
// pelo celular. O build publicado nunca capturou recibo (a chamada está
// comentada em lib/iapService.js), então NADA neste arquivo consegue verificar
// os assinantes atuais. O caminho que está de pé é _shared/appleServerApi.ts,
// que usa a App Store Server API e não depende do app.
//
// Este arquivo só volta a ser útil se um build futuro passar a enviar recibo —
// e mesmo aí, a Server API é a opção recomendada pela Apple.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  PRODUCT_TO_PLAN,
  EXPECTED_BUNDLE_ID,
  FREE_STATE,
  persistState,
  type SubscriptionState,
} from './subscription.ts'

// Reexportados para não quebrar quem já importava daqui.
export {
  PRODUCT_TO_PLAN,
  EXPECTED_BUNDLE_ID,
  FREE_STATE,
  createAdminClient,
  persistState,
  corsHeaders,
  jsonResponse,
} from './subscription.ts'
export type { SubscriptionState } from './subscription.ts'

const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt'
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt'

export class AppleValidationError extends Error {
  constructor(message: string, public status: number | null = null) {
    super(message)
    this.name = 'AppleValidationError'
  }
}

const APPLE_STATUS_MESSAGES: Record<number, string> = {
  21000: 'App Store não conseguiu ler o JSON enviado',
  21002: 'receipt-data malformado ou ausente',
  21003: 'Recibo não pôde ser autenticado',
  21004: 'Shared secret não confere com o configurado no App Store Connect',
  21005: 'Servidor de recibos da Apple indisponível',
  21010: 'Recibo não autorizado',
}

/**
 * Manda o recibo para a Apple.
 *
 * A ordem importa e é prescrita pela Apple: sempre tentar PRODUÇÃO primeiro e
 * cair para sandbox no status 21007. O código anterior fazia o contrário
 * (`if (status === 21007 && !isProduction)`), o que nunca disparava — 21007 só
 * acontece quando você bate em produção. Resultado: builds de TestFlight
 * falhavam a validação silenciosamente.
 *
 * Também não confiamos mais no cliente para dizer qual ambiente usar. Aquilo
 * era um parâmetro do corpo da requisição, ou seja, escolhido por quem chama.
 */
export async function verifyWithApple(receipt: string): Promise<any> {
  const sharedSecret = Deno.env.get('APPLE_IAP_SHARED_SECRET')
  if (!sharedSecret) {
    throw new AppleValidationError(
      'APPLE_IAP_SHARED_SECRET não configurado nas secrets da Edge Function'
    )
  }

  const payload = {
    'receipt-data': receipt,
    'password': sharedSecret,
    // Precisamos do histórico completo para achar a renovação mais recente.
    'exclude-old-transactions': false,
  }

  const call = async (url: string) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      throw new AppleValidationError(
        `Apple respondeu HTTP ${response.status} ${response.statusText}`
      )
    }
    return await response.json()
  }

  let data = await call(APPLE_PRODUCTION_URL)

  if (data.status === 21007) {
    // Recibo de sandbox mandado para produção. Normal em TestFlight e dev.
    console.log('Recibo é de sandbox, revalidando no ambiente sandbox...')
    data = await call(APPLE_SANDBOX_URL)
  } else if (data.status === 21008) {
    // Caminho inverso, raro, mas barato de tratar.
    console.log('Recibo é de produção, revalidando no ambiente de produção...')
    data = await call(APPLE_PRODUCTION_URL)
  }

  if (data.status !== 0) {
    // 21006 = assinatura expirada, mas o recibo em si é válido e utilizável.
    // Não é erro: é a resposta legítima de "esse usuário não é mais assinante".
    if (data.status !== 21006) {
      throw new AppleValidationError(
        APPLE_STATUS_MESSAGES[data.status] ?? `Recibo inválido (status ${data.status})`,
        data.status
      )
    }
  }

  // Um recibo de outro app não pode conceder plano neste app.
  const bundleId = data.receipt?.bundle_id
  if (bundleId && bundleId !== EXPECTED_BUNDLE_ID) {
    throw new AppleValidationError(
      `Recibo pertence a outro app (bundle ${bundleId})`
    )
  }

  return data
}

/**
 * Traduz a resposta da Apple no estado que o app entende.
 *
 * A regra de ouro: a assinatura vigente é a de MAIOR data de expiração entre os
 * nossos produtos, não a mais recentemente comprada. Numa troca de plano a Apple
 * pode emitir transações fora de ordem cronológica, e ordenar por data de compra
 * (como o código antigo fazia) escolhe a errada.
 */
export function deriveState(appleResponse: any): SubscriptionState {
  const entries: any[] = appleResponse.latest_receipt_info
    ?? appleResponse.receipt?.in_app
    ?? []

  const relevant = entries.filter((entry) => {
    if (!PRODUCT_TO_PLAN[entry.product_id]) return false
    // cancellation_date_ms = a Apple estornou ou revogou a compra.
    // Acesso tem que sumir na hora, independente da data de expiração.
    if (entry.cancellation_date_ms) return false
    return true
  })

  if (relevant.length === 0) {
    return { ...FREE_STATE, latestReceipt: appleResponse.latest_receipt ?? null }
  }

  const current = relevant.reduce((latest, entry) =>
    Number(entry.expires_date_ms ?? 0) > Number(latest.expires_date_ms ?? 0) ? entry : latest
  )

  const expiresMs = Number(current.expires_date_ms ?? 0)
  const originalTransactionId = current.original_transaction_id ?? null

  // pending_renewal_info é o que conta o futuro: se vai renovar, se a cobrança
  // está falhando, se a Apple concedeu período de graça.
  const renewal = (appleResponse.pending_renewal_info ?? []).find((info: any) =>
    info.original_transaction_id === originalTransactionId
  ) ?? (appleResponse.pending_renewal_info ?? [])[0]

  const autoRenew = renewal?.auto_renew_status === '1'
  const graceMs = Number(renewal?.grace_period_expires_date_ms ?? 0)

  const now = Date.now()

  // Durante o período de graça a Apple ainda está tentando cobrar e pede que o
  // acesso seja mantido. O app decide acesso por subscription_expires_at, então
  // estendemos essa data até o fim da graça — assim o gating existente já
  // respeita a graça sem precisar de lógica nova espalhada pelas telas.
  const effectiveExpiryMs = Math.max(expiresMs, graceMs)
  const isActive = effectiveExpiryMs > now

  if (!isActive) {
    return {
      ...FREE_STATE,
      originalTransactionId,
      environment: appleResponse.environment ?? null,
      latestReceipt: appleResponse.latest_receipt ?? null,
      reason: `Assinatura ${current.product_id} expirou em ${new Date(expiresMs).toISOString()}`,
    }
  }

  const plan = PRODUCT_TO_PLAN[current.product_id]

  return {
    plan,
    // 'cancelled' aqui significa "não vai renovar, mas ainda tem acesso pago".
    // checkSubscriptionStatus em subscriptionService.js já trata esse caso
    // corretamente (libera acesso enquanto expires_at for futuro).
    status: autoRenew ? 'active' : 'cancelled',
    expiresAt: new Date(effectiveExpiryMs).toISOString(),
    gracePeriodEndsAt: graceMs > now ? new Date(graceMs).toISOString() : null,
    autoRenew,
    productId: current.product_id,
    originalTransactionId,
    transactionId: current.transaction_id ?? null,
    environment: appleResponse.environment ?? null,
    latestReceipt: appleResponse.latest_receipt ?? null,
    reason: autoRenew
      ? `Assinatura ${plan} ativa, renova em ${new Date(expiresMs).toISOString()}`
      : `Assinatura ${plan} cancelada, acesso até ${new Date(expiresMs).toISOString()}`,
  }
}

/**
 * Fluxo completo: recibo → Apple → banco. É o que as três funções chamam.
 *
 * @param receipt recibo novo vindo do app; se ausente, usa o guardado no perfil
 */
export async function syncSubscription(
  admin: SupabaseClient,
  userId: string,
  receipt?: string | null
): Promise<SubscriptionState> {
  let receiptToUse = receipt

  if (!receiptToUse) {
    const { data: profile, error } = await admin
      .from('profiles')
      .select('subscription_receipt')
      .eq('id', userId)
      .single()

    if (error) {
      throw new Error(`Perfil não encontrado: ${error.message}`)
    }
    receiptToUse = profile?.subscription_receipt
  }

  if (!receiptToUse) {
    // Sem recibo não há o que verificar. Importante NÃO rebaixar o usuário aqui:
    // pode ser alguém que assinou antes deste sistema existir e ainda não
    // reabriu o app. Rebaixar por falta de dado foi exatamente o bug que
    // derrubava assinantes legítimos para o plano grátis.
    throw new AppleValidationError('Nenhum recibo disponível para este usuário')
  }

  const appleResponse = await verifyWithApple(receiptToUse)
  const state = deriveState(appleResponse)
  await persistState(admin, userId, state)

  console.log(`Assinatura sincronizada [${userId}]: ${state.reason}`)
  return state
}
