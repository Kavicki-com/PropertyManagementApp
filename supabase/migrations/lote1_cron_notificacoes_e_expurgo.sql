-- Lote 1, tarefas 1.0, 1.12 e 1.3 — aplicadas em 2026-09-17.
--
-- ATENÇÃO: este arquivo NÃO está no histórico de migrations do Supabase. São
-- mudanças de configuração e de dados, aplicadas via SQL direto, guardadas
-- aqui para que o estado do cron seja reproduzível e auditável.

-- ---------------------------------------------------------------------------
-- 1.0 — Desligar o cron horário de notificações.
--
-- Havia dois jobs chamando a mesma Edge Function: um de hora em hora
-- (jobid 3) e um diário ao meio-dia (jobid 2). Com a dedup quebrada pelo bug
-- da 1.1, o horário criava uma leva de notificações a cada hora — fator 24.
-- Desativar em vez de apagar: é reversível com cron.alter_job(3, active := true).
-- ---------------------------------------------------------------------------

select cron.alter_job(3, active := false);

-- ---------------------------------------------------------------------------
-- 1.12 — Tirar as chaves de dentro do comando do cron.
--
-- Os dois jobs de notificação traziam o JWT em texto claro no campo `command`,
-- legível por qualquer um com acesso a cron.job. Pior: o horário usava a chave
-- ANON, e o diário mandava o JWT sem o prefixo "Bearer ".
--
-- Ambos passam a ler a service_role do Vault, no mesmo padrão que o job
-- revalidate-subscriptions-hourly já usava.
-- ---------------------------------------------------------------------------

select cron.alter_job(
  2,  -- process-notifications-daily
  command := $cmd$
    select net.http_post(
      url := 'https://gojfugdhndzhuxehoyvb.supabase.co/functions/v1/process-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'service_role_key'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    ) as request_id;
  $cmd$
);

select cron.alter_job(
  3,  -- process-notifications-hourly (inativo, mas não deve voltar com chave anon)
  command := $cmd$
    select net.http_post(
      url := 'https://gojfugdhndzhuxehoyvb.supabase.co/functions/v1/process-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'service_role_key'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    ) as request_id;
  $cmd$
);

-- ---------------------------------------------------------------------------
-- 1.3 — Expurgo das notificações duplicadas: 13.115 linhas -> 25.
--
-- ORDEM OBRIGATÓRIA: só rodar DEPOIS da 1.1. Sem a correção da função, o
-- próximo ciclo do cron recria tudo o que foi apagado.
--
-- Guarda a mais recente por (user_id, type) e descarta o resto. A cópia
-- integral foi para backup.notifications_20260917, num schema que o PostgREST
-- não expõe — nada de tabela de backup no public, que ficaria legível pela API.
-- ---------------------------------------------------------------------------

create schema if not exists backup;
create table backup.notifications_20260917 as select * from notifications;

delete from notifications n
where n.id not in (
  select distinct on (user_id, type) id
  from notifications
  order by user_id, type, created_at desc
);

-- Aceite da tarefa (verificar em 48h de produção): nenhum usuário acima de
-- 5 notificações criadas por dia.
--
--   select user_id, created_at::date, count(*)
--   from notifications group by 1, 2 order by 3 desc;
