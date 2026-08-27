// supabase/functions/_shared/appleServerApi.ts
//
// Cliente da App Store Server API.
//
// POR QUE ESTE ARQUIVO EXISTE
//
// O caminho anterior (verifyReceipt) tinha dois problemas fatais para o nosso
// caso. Primeiro, exige um recibo base64 vindo do celular — e o build que está
// publicado nunca capturou recibo nenhum (a chamada está comentada em
// lib/iapService.js). Sem recibo, aquele caminho não consegue verificar
// absolutamente ninguém. Segundo, a Apple depreciou verifyReceipt.
//
// A App Store Server API resolve os dois: consulta por originalTransactionId,
// que é um dado que o SERVIDOR obtém sozinho (via webhook ou histórico de
// notificações). O app não participa. Logo, não precisa de build novo.
//
// SECRETS NECESSÁRIAS (Supabase > Edge Functions > Secrets):
//   APPLE_KEY_ID          Key ID da chave In-App Purchase
//   APPLE_ISSUER_ID       Issuer ID do App Store Connect
//   APPLE_PRIVATE_KEY     Conteúdo do .p8, incluindo as linhas BEGIN/END
//   APPLE_BUNDLE_ID       (opcional) padrão com.kavicki.com.llord

import { PRODUCT_TO_PLAN, EXPECTED_BUNDLE_ID, type SubscriptionState, FREE_STATE } from './subscription.ts'

const PRODUCTION_BASE = 'https://api.storekit.itunes.apple.com'
const SANDBOX_BASE = 'https://api.storekit-sandbox.itunes.apple.com'

/** status de assinatura devolvido pela Apple em lastTransactions[].status */
export const APPLE_STATUS = {
  ACTIVE: 1,
  EXPIRED: 2,
  BILLING_RETRY: 3,
  GRACE_PERIOD: 4,
  REVOKED: 5,
} as const

export class AppleServerApiError extends Error {
  constructor(message: string, public httpStatus: number | null = null) {
    super(message)
    this.name = 'AppleServerApiError'
  }
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlText(text: string): string {
  return base64url(new TextEncoder().encode(text))
}

/** Converte o .p8 (PEM PKCS#8) em ArrayBuffer para o Web Crypto. */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

/**
 * Assina o JWT ES256 exigido pela Apple.
 *
 * A Apple recusa tokens com validade acima de 60 minutos. Usamos 20, que dá
 * folga larga para uma execução de Edge Function e limita a janela caso o token
 * vaze num log.
 */
async function createBearerToken(): Promise<string> {
  const keyId = Deno.env.get('APPLE_KEY_ID')
  const issuerId = Deno.env.get('APPLE_ISSUER_ID')
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY')
  const bundleId = Deno.env.get('APPLE_BUNDLE_ID') ?? EXPECTED_BUNDLE_ID

  if (!keyId || !issuerId || !privateKey) {
    throw new AppleServerApiError(
      'APPLE_KEY_ID, APPLE_ISSUER_ID e APPLE_PRIVATE_KEY precisam estar nas secrets da Edge Function'
    )
  }

  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' }
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 20 * 60,
    aud: 'appstoreconnect-v1',
    bid: bundleId,
  }

  const signingInput = `${base64urlText(JSON.stringify(header))}.${base64urlText(JSON.stringify(payload))}`

  // O .p8 costuma chegar nas secrets com "\n" literal em vez de quebra de linha
  // de verdade, dependendo de como foi colado. Normalizamos os dois casos.
  const normalizedKey = privateKey.includes('\\n')
    ? privateKey.replace(/\\n/g, '\n')
    : privateKey

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(normalizedKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  // Web Crypto devolve a assinatura já no formato r||s (64 bytes), que é
  // exatamente o que ES256 espera. Não precisa desempacotar DER.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput)
  )

  return `${signingInput}.${base64url(new Uint8Array(signature))}`
}

/**
 * Chama a App Store Server API tentando produção e caindo para sandbox.
 *
 * Produção e sandbox são hosts separados e uma transação existe em apenas um
 * deles. Produção responde 404 para uma transação de sandbox, então tratamos
 * 404 como "tente o outro ambiente" em vez de erro definitivo.
 */
async function callApi(path: string, init?: RequestInit): Promise<any> {
  const token = await createBearerToken()

  const attempt = async (base: string) => {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    return response
  }

  let response = await attempt(PRODUCTION_BASE)

  if (response.status === 404) {
    console.log('Não encontrado em produção, tentando sandbox...')
    response = await attempt(SANDBOX_BASE)
  }

  if (!response.ok) {
    const body = await response.text()
    throw new AppleServerApiError(
      `App Store Server API respondeu ${response.status}: ${body.slice(0, 400)}`,
      response.status
    )
  }

  return await response.json()
}

/** Lê o corpo de um JWS assinado pela Apple sem verificar a assinatura. */
export function decodeSignedPayload(jws: string): any {
  const segments = jws.split('.')
  if (segments.length !== 3) {
    throw new Error('JWS malformado')
  }
  const b64 = segments[1].replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  return JSON.parse(atob(padded))
}

/**
 * Estado atual da assinatura, direto da Apple.
 *
 * Aceita qualquer transactionId da cadeia (original ou de uma renovação) — a
 * Apple resolve para a assinatura correta.
 */
export async function getSubscriptionState(transactionId: string): Promise<SubscriptionState> {
  const result = await callApi(`/inApps/v1/subscriptions/${transactionId}`)

  if (result.bundleId && result.bundleId !== EXPECTED_BUNDLE_ID) {
    throw new AppleServerApiError(`Transação pertence a outro app (${result.bundleId})`)
  }

  // data[] vem agrupado por subscription group. Achatamos e ficamos com a
  // transação de maior data de expiração entre os nossos produtos — a mesma
  // regra do caminho de recibo: numa troca de plano a ordem cronológica de
  // compra não indica qual assinatura está valendo.
  const candidates: Array<{ tx: any; renewal: any }> = []

  for (const group of result.data ?? []) {
    for (const last of group.lastTransactions ?? []) {
      // 5 = REVOKED. Estorno ou revogação: acesso cai na hora, sem olhar data.
      if (last.status === APPLE_STATUS.REVOKED) continue
      if (!last.signedTransactionInfo) continue

      const tx = decodeSignedPayload(last.signedTransactionInfo)
      if (!PRODUCT_TO_PLAN[tx.productId]) continue

      const renewal = last.signedRenewalInfo
        ? decodeSignedPayload(last.signedRenewalInfo)
        : null

      candidates.push({ tx, renewal })
    }
  }

  if (candidates.length === 0) {
    return {
      ...FREE_STATE,
      environment: result.environment ?? null,
      reason: 'Nenhuma assinatura ativa dos nossos produtos nesta transação',
    }
  }

  const best = candidates.reduce((a, b) =>
    Number(b.tx.expiresDate ?? 0) > Number(a.tx.expiresDate ?? 0) ? b : a
  )

  const { tx, renewal } = best
  const expiresMs = Number(tx.expiresDate ?? 0)
  const graceMs = Number(renewal?.gracePeriodExpiresDate ?? 0)
  const autoRenew = renewal?.autoRenewStatus === 1

  // Durante o período de graça a Apple ainda está tentando cobrar e pede que o
  // acesso seja mantido. O gating do app olha subscription_expires_at, então
  // estendemos essa data até o fim da graça e a regra existente já respeita.
  const effectiveExpiryMs = Math.max(expiresMs, graceMs)
  const now = Date.now()
  const plan = PRODUCT_TO_PLAN[tx.productId]

  if (effectiveExpiryMs <= now) {
    return {
      ...FREE_STATE,
      originalTransactionId: tx.originalTransactionId ?? null,
      environment: tx.environment ?? result.environment ?? null,
      reason: `Assinatura ${tx.productId} expirou em ${new Date(expiresMs).toISOString()}`,
    }
  }

  return {
    plan,
    // 'cancelled' aqui significa "não vai renovar, mas ainda tem acesso pago".
    status: autoRenew ? 'active' : 'cancelled',
    expiresAt: new Date(effectiveExpiryMs).toISOString(),
    gracePeriodEndsAt: graceMs > now ? new Date(graceMs).toISOString() : null,
    autoRenew,
    productId: tx.productId,
    originalTransactionId: tx.originalTransactionId ?? null,
    transactionId: tx.transactionId ?? null,
    environment: tx.environment ?? result.environment ?? null,
    latestReceipt: null,
    reason: autoRenew
      ? `Assinatura ${plan} ativa, renova em ${new Date(expiresMs).toISOString()}`
      : `Assinatura ${plan} cancelada, acesso até ${new Date(expiresMs).toISOString()}`,
  }
}

/**
 * Notificações que a Apple nos mandou nos últimos N dias.
 *
 * É o que permite descobrir retroativamente quem são os assinantes: cada
 * notificação carrega o originalTransactionId. Sem isto, só saberíamos de um
 * usuário quando a próxima renovação dele acontecesse — o que pode levar um mês.
 *
 * A Apple guarda 180 dias. Aceita no máximo 180 dias por consulta.
 */
export async function getNotificationHistory(daysBack = 180): Promise<any[]> {
  const endDate = Date.now()
  const startDate = endDate - daysBack * 24 * 3600_000

  const collected: any[] = []
  let paginationToken: string | undefined

  do {
    const path = `/inApps/v1/notifications/history${paginationToken ? `?paginationToken=${encodeURIComponent(paginationToken)}` : ''}`

    const page = await callApi(path, {
      method: 'POST',
      body: JSON.stringify({ startDate, endDate }),
    })

    for (const entry of page.notificationHistory ?? []) {
      if (!entry.signedPayload) continue
      try {
        collected.push(decodeSignedPayload(entry.signedPayload))
      } catch (err) {
        console.warn('Notificação do histórico ilegível, pulando:', err)
      }
    }

    paginationToken = page.hasMore ? page.paginationToken : undefined
  } while (paginationToken)

  return collected
}

/**
 * Pede à Apple que dispare uma notificação de teste na URL configurada.
 *
 * Vale mais do que parece: é a única forma de confirmar, sem esperar uma
 * renovação real, que as três pontas estão de pé — nossas credenciais, a URL
 * cadastrada no App Store Connect e a nossa função respondendo. Devolve um
 * token que depois é consultado em getTestNotificationStatus.
 */
export async function requestTestNotification(): Promise<string> {
  const result = await callApi('/inApps/v1/notifications/test', { method: 'POST' })
  return result.testNotificationToken
}

/** Resultado da entrega de uma notificação de teste. */
export async function getTestNotificationStatus(token: string): Promise<any> {
  return await callApi(`/inApps/v1/notifications/test/${encodeURIComponent(token)}`)
}

/**
 * Acha a transação a partir do Order ID que aparece no e-mail de recibo da
 * Apple (formato tipo "MT1DZ7801X").
 *
 * É a saída para assinantes que compraram antes de existir qualquer rastreio do
 * nosso lado: o cliente encaminha o recibo, e o Order ID dá o
 * originalTransactionId sem precisar do app nem esperar a próxima renovação.
 */
export async function lookupOrderId(orderId: string): Promise<any> {
  const result = await callApi(`/inApps/v1/lookup/${encodeURIComponent(orderId)}`)

  // status 0 = order id válido. 1 = inválido.
  const transactions = (result.signedTransactions ?? []).map((jws: string) => {
    try {
      return decodeSignedPayload(jws)
    } catch {
      return null
    }
  }).filter(Boolean)

  return { status: result.status, transactions }
}

/** Extrai o originalTransactionId de um payload de notificação V2 já decodificado. */
export function originalTransactionIdOf(payload: any): string | null {
  const signedTx = payload?.data?.signedTransactionInfo
  if (signedTx) {
    try {
      return decodeSignedPayload(signedTx)?.originalTransactionId ?? null
    } catch {
      // cai para o campo direto abaixo
    }
  }
  return payload?.data?.originalTransactionId ?? null
}
