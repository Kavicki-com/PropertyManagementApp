// supabase/functions/validate-iap-receipt/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// URLs da Apple para validação de receipts
const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt'
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt'

interface ReceiptValidationRequest {
  receipt: string // Receipt data em base64
  productId?: string
  userId?: string
  isProduction?: boolean
}

interface AppleReceiptResponse {
  status: number
  environment?: 'Sandbox' | 'Production'
  receipt?: {
    receipt_type: string
    bundle_id: string
    in_app?: Array<{
      transaction_id: string
      original_transaction_id: string
      product_id: string
      purchase_date_ms: string
      expires_date_ms?: string
    }>
  }
  latest_receipt_info?: Array<{
    transaction_id: string
    original_transaction_id: string
    product_id: string
    purchase_date_ms: string
    expires_date_ms?: string
  }>
  pending_renewal_info?: Array<{
    expiration_intent?: number
    auto_renew_status: number
    product_id: string
  }>
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { receipt, productId, userId, isProduction }: ReceiptValidationRequest = await req.json()

    if (!receipt) {
      return new Response(
        JSON.stringify({ error: 'Receipt data é obrigatório' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Obtém shared secret das variáveis de ambiente (configurar no Supabase Dashboard)
    const sharedSecret = Deno.env.get('APPLE_IAP_SHARED_SECRET') || ''
    
    // Prepara payload para enviar à Apple
    const payload = {
      'receipt-data': receipt,
      'password': sharedSecret, // Shared secret (opcional mas recomendado)
      'exclude-old-transactions': false,
    }

    // Tenta validar primeiro no ambiente de produção (ou sandbox conforme indicado)
    const appleUrl = isProduction ? APPLE_PRODUCTION_URL : APPLE_SANDBOX_URL
    
    console.log(`Validando receipt na Apple (${isProduction ? 'Production' : 'Sandbox'})...`)
    
    let response = await fetch(appleUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Erro ao validar receipt: ${response.statusText}`)
    }

    let data: AppleReceiptResponse = await response.json()

    // Se o status for 21007, significa que o receipt é do sandbox mas tentamos validar em produção
    // Nesse caso, tentamos novamente no sandbox
    if (data.status === 21007 && !isProduction) {
      console.log('Receipt é do sandbox, tentando validar no sandbox...')
      response = await fetch(APPLE_SANDBOX_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Erro ao validar receipt no sandbox: ${response.statusText}`)
      }

      data = await response.json()
    }

    // Verifica status da resposta
    // Status 0 = sucesso
    // Status 21007 = receipt é do sandbox (já tratado acima)
    // Outros status indicam erros
    if (data.status !== 0 && data.status !== 21007) {
      const statusMessages: Record<number, string> = {
        21000: 'The App Store could not read the JSON object you provided',
        21002: 'The data in the receipt-data property was malformed or missing',
        21003: 'The receipt could not be authenticated',
        21004: 'The shared secret you provided does not match the shared secret on file',
        21005: 'The receipt server is not currently available',
        21006: 'This receipt is valid but the subscription has expired',
        21008: 'This receipt is from the test environment, but it was sent to the production environment',
      }

      return new Response(
        JSON.stringify({ 
          error: 'Receipt inválido',
          status: data.status,
          message: statusMessages[data.status] || 'Erro desconhecido',
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verifica se o receipt contém informações da assinatura
    const latestReceiptInfo = data.latest_receipt_info || data.receipt?.in_app || []
    
    if (latestReceiptInfo.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Receipt não contém informações de assinatura',
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Se productId foi fornecido, valida se está presente no receipt
    if (productId) {
      const hasProduct = latestReceiptInfo.some(
        (item: any) => item.product_id === productId
      )
      
      if (!hasProduct) {
        return new Response(
          JSON.stringify({ 
            error: `Product ID ${productId} não encontrado no receipt`,
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // Encontra a assinatura mais recente (para o productId específico se fornecido)
    const relevantSubscription = productId
      ? latestReceiptInfo.find((item: any) => item.product_id === productId) || latestReceiptInfo[0]
      : latestReceiptInfo[0]

    // Verifica se a assinatura está ativa
    const expiresDate = relevantSubscription.expires_date_ms
      ? parseInt(relevantSubscription.expires_date_ms)
      : null
    
    const isActive = expiresDate ? Date.now() < expiresDate : true

    // Prepara resposta com informações validadas
    const validationResult = {
      valid: true,
      environment: data.environment || (isProduction ? 'Production' : 'Sandbox'),
      productId: relevantSubscription.product_id,
      transactionId: relevantSubscription.transaction_id,
      originalTransactionId: relevantSubscription.original_transaction_id,
      purchaseDate: new Date(parseInt(relevantSubscription.purchase_date_ms)).toISOString(),
      expiresDate: expiresDate ? new Date(expiresDate).toISOString() : null,
      isActive,
      bundleId: data.receipt?.bundle_id || '',
    }

    console.log('Receipt validado com sucesso:', validationResult)

    return new Response(
      JSON.stringify({ 
        success: true,
        ...validationResult
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Erro inesperado ao validar receipt:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor ao validar receipt',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
