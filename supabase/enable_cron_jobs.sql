-- enable_cron_jobs.sql

-- Enable the pg_cron extension
create extension if not exists pg_cron;
-- Enable the pg_net extension (required to call Edge Functions via web triggers)
create extension if not exists pg_net;

-- DELETE previously scheduled job if exists to avoid dupes
SELECT cron.unschedule('process-notifications-daily');

-- Schedule the job to run every day at 12:00 UTC (09:00 BRT)
-- IMPORTANT: Replace YOUR_SERVICE_ROLE_KEY below with your actual Supabase Service Role Key
-- You can find it in Project Settings -> API -> service_role (secret)
-- Also ensure the URL matches your project: https://gojfugdhndzhuxehoyvb.supabase.co
select cron.schedule(
  'process-notifications-daily',
  '0 12 * * *',
  $$
  select
    net.http_post(
      url:='https://gojfugdhndzhuxehoyvb.supabase.co/functions/v1/process-notifications',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
