// supabase/functions/send-push-notification/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send'

interface ExpoPushMessage {
  to: string
  sound?: string
  title: string
  body: string
  data?: Record<string, any>
  priority?: 'default' | 'normal' | 'high'
  channelId?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Cria cliente Supabase com serviceRoleKey para ter permissões de admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Obtém dados da requisição
    const { notification_id } = await req.json()

    if (!notification_id) {
      return new Response(
        JSON.stringify({ error: 'notification_id é obrigatório' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Busca a notificação
    const { data: notification, error: notificationError } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('id', notification_id)
      .single()

    if (notificationError || !notification) {
      console.error('Erro ao buscar notificação:', notificationError)
      return new Response(
        JSON.stringify({ error: 'Notificação não encontrada' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Busca todos os tokens de push do usuário
    const { data: pushTokens, error: tokensError } = await supabaseAdmin
      .from('user_push_tokens')
      .select('expo_push_token')
      .eq('user_id', notification.user_id)

    if (tokensError) {
      console.error('Erro ao buscar tokens:', tokensError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar tokens de push' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!pushTokens || pushTokens.length === 0) {
      console.log('Usuário não possui tokens de push registrados')
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum token de push encontrado', sent: 0 }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Prepara mensagens para todos os dispositivos
    const messages: ExpoPushMessage[] = pushTokens.map(token => ({
      to: token.expo_push_token,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: {
        ...notification.data,
        notification_id: notification.id,
        type: notification.type,
      },
      priority: 'high',
    }))

    // Envia push notifications via Expo Push API
    const pushResponse = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })

    if (!pushResponse.ok) {
      const errorText = await pushResponse.text()
      console.error('Erro ao enviar push via Expo:', errorText)
      return new Response(
        JSON.stringify({ error: 'Erro ao enviar push notification', details: errorText }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const pushResults = await pushResponse.json()
    const successCount = pushResults.data?.filter((r: any) => r.status === 'ok').length || 0

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Push notifications enviadas',
        sent: successCount,
        total: messages.length,
        results: pushResults
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Erro inesperado:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})




