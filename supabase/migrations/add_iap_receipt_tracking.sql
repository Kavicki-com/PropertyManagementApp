-- Rastreio de recibo IAP: permite que o SERVIDOR verifique o estado real da
-- assinatura junto à Apple, em vez do app calcular "compra + 30 dias" no celular.
--
-- A ideia central: guardamos o recibo (base64) do usuário. O recibo é uma chave
-- permanente — mandando ele para a Apple a qualquer momento, ela devolve o
-- estado ATUAL da assinatura, incluindo renovações que aconteceram depois.
-- É assim que passamos a detectar renovação automática sem o app estar aberto.

ALTER TABLE profiles
  -- Recibo base64 mais recente conhecido. A Apple devolve um `latest_receipt`
  -- atualizado a cada validação; guardamos sempre o mais novo.
  ADD COLUMN IF NOT EXISTS subscription_receipt TEXT,

  -- Identificador que a Apple mantém estável por TODA a vida da assinatura,
  -- atravessando renovações, upgrades e downgrades. É a chave que liga uma
  -- notificação do webhook da Apple ao usuário certo aqui.
  ADD COLUMN IF NOT EXISTS subscription_original_transaction_id TEXT,

  -- Se a Apple vai cobrar de novo no fim do período. Falso = usuário cancelou,
  -- mas continua com acesso até subscription_expires_at.
  ADD COLUMN IF NOT EXISTS subscription_auto_renew BOOLEAN DEFAULT TRUE,

  -- 'Sandbox' ou 'Production'. Assinatura de sandbox renova a cada 5 minutos e
  -- só sobrevive a 6 renovações — sem isso, dados de teste parecem produção.
  ADD COLUMN IF NOT EXISTS subscription_environment TEXT,

  -- Product ID da Apple que originou o plano atual. Útil para auditar
  -- divergência entre o que a Apple cobra e o plano que concedemos.
  ADD COLUMN IF NOT EXISTS subscription_product_id TEXT,

  -- Quando falamos com a Apple pela última vez sobre este usuário.
  -- A varredura de cron usa isto para priorizar quem está mais desatualizado.
  ADD COLUMN IF NOT EXISTS subscription_last_verified_at TIMESTAMPTZ;

-- Timestamps sem timezone são uma armadilha: o Postgres descarta o offset na
-- gravação e devolve a string "pelada", obrigando o cliente a readicionar 'Z'
-- na mão (é o que parseSupabaseDate faz hoje em 3 arquivos diferentes).
-- Convertendo para TIMESTAMPTZ o offset passa a viajar junto com o dado.
--
-- Seguro para o app atual: parseSupabaseDate já trata string com '+' offset,
-- então continua funcionando durante o rollout, antes e depois do deploy.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
      AND column_name = 'subscription_expires_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE profiles
      ALTER COLUMN subscription_started_at TYPE TIMESTAMPTZ
        USING subscription_started_at AT TIME ZONE 'UTC',
      ALTER COLUMN subscription_expires_at TYPE TIMESTAMPTZ
        USING subscription_expires_at AT TIME ZONE 'UTC',
      ALTER COLUMN subscription_trial_ends_at TYPE TIMESTAMPTZ
        USING subscription_trial_ends_at AT TIME ZONE 'UTC',
      ALTER COLUMN subscription_grace_period_ends_at TYPE TIMESTAMPTZ
        USING subscription_grace_period_ends_at AT TIME ZONE 'UTC';
  END IF;
END $$;

-- Busca pelo original_transaction_id: caminho quente do webhook da Apple, que
-- chega sabendo só esse ID e precisa achar o usuário.
CREATE INDEX IF NOT EXISTS idx_profiles_original_transaction_id
  ON profiles(subscription_original_transaction_id)
  WHERE subscription_original_transaction_id IS NOT NULL;

-- Varredura do cron: só interessam quem tem recibo guardado.
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_revalidation
  ON profiles(subscription_last_verified_at)
  WHERE subscription_receipt IS NOT NULL;

COMMENT ON COLUMN profiles.subscription_receipt IS
  'Recibo base64 da App Store. Revalidado periodicamente para detectar renovação automática. Gravado apenas pelas Edge Functions (service_role).';
COMMENT ON COLUMN profiles.subscription_original_transaction_id IS
  'original_transaction_id da Apple. Estável por toda a vida da assinatura; é a chave usada pelo webhook App Store Server Notifications.';
COMMENT ON COLUMN profiles.subscription_auto_renew IS
  'auto_renew_status da Apple. FALSE = cancelado pelo usuário, mas com acesso válido até subscription_expires_at.';
COMMENT ON COLUMN profiles.subscription_environment IS
  'Sandbox ou Production, conforme informado pela Apple na validação do recibo.';
COMMENT ON COLUMN profiles.subscription_last_verified_at IS
  'Última confirmação bem-sucedida junto à Apple.';
