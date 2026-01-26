-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the notification processing job to run every hour
-- NOTE: Requires the 'process-notifications' function to be deployed
SELECT cron.schedule(
  'process-notifications-hourly', -- name of the cron job
  '0 * * * *', -- every hour (at minute 0)
  $$
    select
      net.http_post(
          url:='https://gojfugdhndzhuxehoyvb.supabase.co/functions/v1/process-notifications',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvamZ1Z2RobmR6aHV4ZWhveXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NTEwNzgsImV4cCI6MjA3NTUyNzA3OH0.Mz94nXAQw3z1HRADATmaNTzPL_-OrX6P8YXXRvpgHHc"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
  $$
);

-- Check if the job was scheduled
SELECT * FROM cron.job;
