// supabase/functions/revalidate-subscriptions/index.ts
//
// Rede de segurança do webhook.
//
// O webhook (appstore-notifications) é o caminho principal e reage em segundos.
// Mas notificação é entrega pela rede: pode falhar, pode chegar enquanto a
// função está com erro, pode ser perdida numa janela de deploy. Se isso
// acontecer numa renovação, o usuário perde acesso e nada se corrige sozinho.
//
// Esta varredura fecha esse buraco: de hora em hora ela pergunta à Apple o
// estado real de quem já está mapeado, e conserta qualquer divergência.
//
// Consulta pela App Store Server API usando subscription_original_transaction_id
// — não depende de recibo, portanto não depende de build novo do app.
//
// Agendada via pg_cron — ver supabase/enable_cron_subscriptions.sql

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  createAdminClient,
  persistState,
  corsHeaders,
  jsonResponse,
} from '../_shared/subscription.ts'
import { getSubscriptionState } from '../_shared/appleServerApi.ts'

// Quantos perfis por execução. Rodando de hora em hora, 200/h dá folga larga
// para a base atual e mantém o tempo de execução bem abaixo do limite.
const BATCH_SIZE = 200

// Requisições simultâneas à Apple. Baixo de propósito: a Apple limita taxa e
// uma Edge Function sai de um pool de IPs compartilhado.
const CONCURRENCY = 5

// Revalidamos com folga antes do vencimento para que a renovação já esteja
// registrada quando o usuário abrir o app.
const EXPIRY_WINDOW_HOURS = 48

// Mesmo quem está longe do vencimento é reconferido de vez em quando, para
// pegar cancelamento e estorno.
const STALE_AFTER_HOURS = 12

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Só o cron chama isto. Comparamos com a service_role key diretamente em vez
  // de confiar na verificação de JWT do gateway, para que a proteção não sumir
  // se a função for reimplantada com --no-verify-jwt.
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const provided = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!serviceRoleKey || provided !== serviceRoleKey) {
    return jsonResponse({ error: 'Não autorizado' }, 401)
  }

  try {
    const admin = createAdminClient()
    const now = Date.now()

    const expiryThreshold = new Date(now + EXPIRY_WINDOW_HOURS * 3600_000).toISOString()
    const staleThreshold = new Date(now - STALE_AFTER_HOURS * 3600_000).toISOString()

    // Quem revalidar: já está mapeado a uma transação da Apple E (está perto de
    // vencer OU está desatualizado OU nunca foi verificado).
    //
    // Perfis sem original_transaction_id ficam de fora de propósito: são as
    // cortesias concedidas na mão, que não existem na Apple. Incluí-las só
    // geraria erro a cada rodada — e, pior, arriscaria rebaixá-las.
    const { data: profiles, error } = await admin
      .from('profiles')
      .select('id, subscription_plan, subscription_expires_at, subscription_original_transaction_id')
      .not('subscription_original_transaction_id', 'is', null)
      .or(
        `subscription_expires_at.lt.${expiryThreshold},` +
        `subscription_last_verified_at.lt.${staleThreshold},` +
        `subscription_last_verified_at.is.null`
      )
      // Mais desatualizados primeiro, para ninguém ficar sem verificação.
      .order('subscription_last_verified_at', { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE)

    if (error) {
      console.error('Erro ao selecionar perfis:', error)
      return jsonResponse({ error: 'Erro ao selecionar perfis' }, 500)
    }

    if (!profiles || profiles.length === 0) {
      return jsonResponse({ success: true, checked: 0, changed: 0, message: 'Nada a revalidar' })
    }

    console.log(`Revalidando ${profiles.length} assinatura(s)...`)

    const changes: Array<Record<string, unknown>> = []
    const failures: Array<Record<string, unknown>> = []

    for (let i = 0; i < profiles.length; i += CONCURRENCY) {
      const slice = profiles.slice(i, i + CONCURRENCY)

      await Promise.all(slice.map(async (profile) => {
        const previousPlan = profile.subscription_plan ?? 'free'
        const previousExpiry = profile.subscription_expires_at

        try {
          const state = await getSubscriptionState(profile.subscription_original_transaction_id)
          await persistState(admin, profile.id, state)

          const planChanged = state.plan !== previousPlan
          const renewed = !!state.expiresAt && !!previousExpiry
            && new Date(state.expiresAt) > new Date(previousExpiry)

          if (planChanged || renewed) {
            changes.push({
              userId: profile.id,
              from: previousPlan,
              to: state.plan,
              renewed,
              expiresAt: state.expiresAt,
            })
            console.log(
              `[${profile.id}] ${previousPlan} → ${state.plan}` +
              `${renewed ? ' (renovada)' : ''} | ${state.reason}`
            )
          }
        } catch (err) {
          // Falha de rede ou transação problemática NÃO rebaixa ninguém. O
          // perfil fica como está e tenta de novo na próxima rodada. Rebaixar
          // por erro transitório foi justamente o que tirava plano de quem pagou.
          failures.push({ userId: profile.id, error: String(err?.message ?? err) })
          console.error(`[${profile.id}] Falha ao revalidar:`, err?.message ?? err)
        }
      }))
    }

    return jsonResponse({
      success: true,
      checked: profiles.length,
      changed: changes.length,
      failed: failures.length,
      changes,
      failures: failures.slice(0, 20),
    })

  } catch (error) {
    console.error('Erro inesperado na revalidação:', error)
    return jsonResponse(
      { error: 'Erro interno', details: String(error?.message ?? error) },
      500
    )
  }
})
