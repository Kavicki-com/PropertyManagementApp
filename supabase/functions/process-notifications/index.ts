// supabase/functions/process-notifications/index.ts
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
        // Create Supabase client with Service Role Key (Admin)
        // This key allows bypassing RLS, which is necessary for checking all users' notifications
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

        console.log('Starting daily notification processing...')

        // 1. Call the database function to check and create new notifications for ALL users
        const { data: createdNotifications, error: rpcError } = await supabaseAdmin.rpc('check_all_notifications')

        if (rpcError) {
            console.error('Error creating notifications:', rpcError)
            return new Response(
                JSON.stringify({ error: 'Failed to create notifications', details: rpcError }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const notificationCount = createdNotifications?.length || 0
        console.log(`Created ${notificationCount} new notifications.`)

        if (notificationCount === 0) {
            return new Response(
                JSON.stringify({ message: 'No new notifications to send.' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Prepare Push Messages
        const messages: ExpoPushMessage[] = []

        // Extract unique user IDs to fetch tokens efficiently
        const userIds = [...new Set(createdNotifications.map((n: any) => n.user_id))]

        // Fetch tokens for all affected users
        const { data: userTokens, error: tokensError } = await supabaseAdmin
            .from('user_push_tokens')
            .select('user_id, expo_push_token')
            .in('user_id', userIds)

        if (tokensError) {
            console.error('Error fetching tokens:', tokensError)
            // We continue, but some users usually won't get push if tokens fail
        }

        // Map user_id -> [tokens]
        const tokensMap: Record<string, string[]> = {}
        userTokens?.forEach((t: any) => {
            if (!tokensMap[t.user_id]) tokensMap[t.user_id] = []
            tokensMap[t.user_id].push(t.expo_push_token)
        })

        // Build the Expo messages
        for (const notification of createdNotifications) {
            const tokens = tokensMap[notification.user_id]
            if (tokens && tokens.length > 0) {
                tokens.forEach(token => {
                    messages.push({
                        to: token,
                        sound: 'default',
                        title: notification.title,
                        body: notification.body,
                        data: {
                            ...notification.data,
                            notification_id: notification.id,
                            screen: notification.data?.screen,
                            type: notification.type
                        },
                        priority: 'high',
                    })
                })
            }
        }

        if (messages.length === 0) {
            return new Response(
                JSON.stringify({
                    success: true,
                    created: notificationCount,
                    message: 'Notifications created but no active push tokens found.'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Send Batch to Expo
        console.log(`Sending ${messages.length} push messages to Expo...`)

        // Expo recommends checking for errors in individual tickets, but for now we just fire and log
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
            console.error('Expo Push Error:', errorText)
            throw new Error(`Expo API rejected the request: ${errorText}`)
        }

        const pushResult = await pushResponse.json()

        return new Response(
            JSON.stringify({
                success: true,
                created: notificationCount,
                sent: messages.length,
                expo_result: pushResult
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
