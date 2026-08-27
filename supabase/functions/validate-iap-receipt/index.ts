// supabase/functions/validate-iap-receipt/index.ts
//
// Chamada pelo app depois de uma compra, na restauração de compras e quando a
// tela de assinatura abre. Valida o recibo com a Apple e grava o plano.
//
// Esta função é a ÚNICA forma de um usuário ganhar um plano pago. O app não
// escreve mais subscription_plan diretamente.
//
// Mudanças em relação à versão anterior:
//  - exige JWT válido e usa o ID do token, não um userId vindo do corpo
//  - confere o bundle_id (antes, recibo de qualquer app era aceito)
//  - produção→sandbox na ordem certa (o retry antigo nunca disparava)
//  - lê expires_date_ms real em vez de assumir 30 dias
//  - grava o resultado no banco (antes só devolvia JSON que ninguém usava)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  createAdminClient,
  syncSubscription,
  AppleValidationError,
  corsHeaders,
  jsonResponse,
} from '../_shared/appleSubscription.ts'

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

    // receipt é opcional: sem ele revalidamos o recibo já guardado no perfil,
    // que é como a tela de assinatura confere renovação sem pedir nada ao iOS.
    let receipt: string | null = null
    try {
      const body = await req.json()
      receipt = body?.receipt ?? null
    } catch {
      // Corpo vazio é uso legítimo: "revalide o que você já tem sobre mim".
    }

    const state = await syncSubscription(admin, user.id, receipt)

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
    if (error instanceof AppleValidationError) {
      console.error('Validação de recibo falhou:', error.message)
      return jsonResponse(
        { error: error.message, appleStatus: error.status },
        400
      )
    }

    console.error('Erro inesperado ao validar recibo:', error)
    return jsonResponse(
      { error: 'Erro interno ao validar recibo', details: String(error?.message ?? error) },
      500
    )
  }
})
