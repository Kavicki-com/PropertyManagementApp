-- Adicionar campos de assinatura na tabela profiles
-- Migração para sistema de monetização por assinatura

-- Adicionar colunas de assinatura
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(20) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_iap_transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_trial_ends_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_grace_period_ends_at TIMESTAMP;

-- Adicionar constraints para validar valores
-- Usa DO block para verificar se as constraints já existem antes de criar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_subscription_plan_check'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT profiles_subscription_plan_check 
      CHECK (subscription_plan IN ('free', 'basic', 'premium'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_subscription_status_check'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT profiles_subscription_status_check 
      CHECK (subscription_status IN ('active', 'expired', 'cancelled', 'trial'));
  END IF;
END $$;

-- Criar índice para melhorar performance em consultas de assinatura
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_plan ON profiles(subscription_plan);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_expires_at ON profiles(subscription_expires_at);

-- Comentários para documentação
COMMENT ON COLUMN profiles.subscription_plan IS 'Plano de assinatura: free, basic, premium';
COMMENT ON COLUMN profiles.subscription_status IS 'Status da assinatura: active, expired, cancelled, trial';
COMMENT ON COLUMN profiles.subscription_started_at IS 'Data de início da assinatura';
COMMENT ON COLUMN profiles.subscription_expires_at IS 'Data de expiração da assinatura';
COMMENT ON COLUMN profiles.subscription_iap_transaction_id IS 'ID da transação IAP (In-App Purchase)';
COMMENT ON COLUMN profiles.subscription_trial_ends_at IS 'Data de fim do período de teste gratuito';
COMMENT ON COLUMN profiles.subscription_grace_period_ends_at IS 'Data de fim do período de graça após expiração';

