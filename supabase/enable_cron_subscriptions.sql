-- Agenda a revalidação de assinaturas.
--
-- O webhook (appstore-notifications) é o caminho principal e reage em segundos.
-- Esta varredura é a rede de segurança: notificação é entrega pela rede e pode
-- falhar, chegar durante um deploy, ou se perder. Se isso acontecer numa
-- renovação, o assinante perde acesso e nada se corrige sozinho.
--
-- POR QUE O VAULT
--
-- A versão anterior deste arquivo pedia para colar a service_role key direto no
-- SQL. Isso deixa a chave em texto puro dentro de cron.job — visível para
-- qualquer um com acesso ao banco, e fácil de vazar num dump ou num commit.
-- Guardando no Vault, o job referencia a chave por nome e o valor fica criptografado.

-- PASSO 1 — guardar a chave (rode UMA VEZ, no SQL Editor do Supabase).
-- Troque o primeiro argumento pela service_role real
-- (Project Settings > API > service_role).
--
--   select vault.create_secret(
--     'COLE_A_SERVICE_ROLE_KEY_AQUI',
--     'service_role_key',
--     'Usada pelo pg_cron para chamar Edge Functions'
--   );
--
-- Para atualizar depois, sem criar duplicata:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'service_role_key'),
--     'NOVA_CHAVE'
--   );

-- PASSO 2 — agendar.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamento anterior, se existir, para o script ser reexecutável.
SELECT cron.unschedule('revalidate-subscriptions-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'revalidate-subscriptions-hourly'
);

-- De hora em hora, aos 20 minutos. Desencontrado das :00 de propósito, para não
-- competir com process-notifications-hourly, que já roda no minuto 0.
SELECT cron.schedule(
  'revalidate-subscriptions-hourly',
  '20 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://gojfugdhndzhuxehoyvb.supabase.co/functions/v1/revalidate-subscriptions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'service_role_key'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    ) AS request_id;
  $$
);

-- CONFERIR
--
--   SELECT jobid, jobname, schedule, active FROM cron.job
--   WHERE jobname = 'revalidate-subscriptions-hourly';
--
-- Execuções (status 'succeeded' aqui significa que o POST foi disparado, não
-- que a função respondeu 200 — para isso, veja os logs da Edge Function):
--
--   SELECT * FROM cron.job_run_details
--   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'revalidate-subscriptions-hourly')
--   ORDER BY start_time DESC LIMIT 20;
--
-- Resposta HTTP de verdade:
--   SELECT * FROM net._http_response ORDER BY created DESC LIMIT 10;
