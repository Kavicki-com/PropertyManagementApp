// supabase/functions/_shared/subscription.ts
//
// Núcleo compartilhado de assinaturas: tipos, mapa de produtos e a ÚNICA função
// que escreve as colunas de assinatura no banco.
//
// Está separado de appleSubscription.ts de propósito. Aquele arquivo carrega o
// caminho de verifyReceipt, que a Apple depreciou e que exige um recibo vindo do
// celular — recibo que o build publicado nunca capturou. O caminho que está de
// pé hoje (App Store Server API) não precisa de nada daquilo, e não faz sentido
// arrastar código morto para dentro de cada Edge Function.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Precisa bater com PRODUCT_IDS em lib/iapService.js.
export const PRODUCT_TO_PLAN: Record<string, 'basic' | 'premium'> = {
  'com.kavicki.com.llord.subscription.basic.monthly': 'basic',
  'com.kavicki.com.llord.subscription.premium.monthly': 'premium',
}

export const EXPECTED_BUNDLE_ID = 'com.kavicki.com.llord'

export interface SubscriptionState {
  plan: 'free' | 'basic' | 'premium'
  status: 'active' | 'cancelled'
  expiresAt: string | null
  gracePeriodEndsAt: string | null
  autoRenew: boolean
  productId: string | null
  originalTransactionId: string | null
  transactionId: string | null
  environment: string | null
  /** Só usado no caminho de recibo. Nulo quando a origem é a Server API. */
  latestReceipt: string | null
  /** Explicação legível de como chegamos neste estado. Vai para os logs. */
  reason: string
}

export const FREE_STATE: SubscriptionState = {
  plan: 'free',
  status: 'active',
  expiresAt: null,
  gracePeriodEndsAt: null,
  autoRenew: false,
  productId: null,
  originalTransactionId: null,
  transactionId: null,
  environment: null,
  latestReceipt: null,
  reason: 'Nenhuma assinatura válida encontrada',
}

export function createAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Grava o estado em profiles. Único ponto de escrita das colunas de assinatura.
 */
export async function persistState(
  admin: SupabaseClient,
  userId: string,
  state: SubscriptionState
): Promise<void> {
  const update: Record<string, unknown> = {
    subscription_plan: state.plan,
    subscription_status: state.status,
    subscription_expires_at: state.expiresAt,
    subscription_grace_period_ends_at: state.gracePeriodEndsAt,
    subscription_auto_renew: state.autoRenew,
    subscription_product_id: state.productId,
    subscription_last_verified_at: new Date().toISOString(),
  }

  // Só sobrescrevemos os identificadores quando a Apple realmente nos deu um.
  // Num estado 'free' derivado de assinatura expirada, o transactionId vem nulo
  // — apagar o vínculo ali quebraria o webhook para renovações futuras e para
  // uma eventual reassinatura.
  if (state.transactionId) {
    update.subscription_iap_transaction_id = state.transactionId
  }
  if (state.originalTransactionId) {
    update.subscription_original_transaction_id = state.originalTransactionId
  }
  if (state.environment) {
    update.subscription_environment = state.environment
  }
  if (state.latestReceipt) {
    update.subscription_receipt = state.latestReceipt
  }

  // subscription_started_at é histórico: só é definido na primeira vez que
  // vemos o usuário como pagante, e nunca sobrescrito por uma renovação.
  if (state.plan !== 'free') {
    const { data: existing } = await admin
      .from('profiles')
      .select('subscription_started_at')
      .eq('id', userId)
      .single()

    if (!existing?.subscription_started_at) {
      update.subscription_started_at = new Date().toISOString()
    }
  }

  const { error } = await admin.from('profiles').update(update).eq('id', userId)
  if (error) {
    throw new Error(`Falha ao gravar assinatura: ${error.message}`)
  }
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
