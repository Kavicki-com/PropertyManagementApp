-- Migração de usuários existentes para sistema de assinatura
-- Define todos os usuários como plano Free e configura período de teste para usuários com mais de 2 imóveis

-- Atualizar todos os usuários existentes para plano Free (se ainda não tiverem plano definido)
UPDATE profiles
SET 
  subscription_plan = 'free',
  subscription_status = 'active'
WHERE subscription_plan IS NULL OR subscription_plan = '';

-- Para usuários com mais de 2 imóveis ativos, definir período de teste de 30 dias
-- Isso permite que eles continuem usando o app durante o período de transição
WITH users_with_excess_properties AS (
  SELECT 
    p.user_id,
    COUNT(*) as property_count
  FROM properties p
  INNER JOIN profiles pr ON p.user_id = pr.id
  WHERE p.archived_at IS NULL
  GROUP BY p.user_id
  HAVING COUNT(*) > 2
)
UPDATE profiles
SET 
  subscription_trial_ends_at = (CURRENT_TIMESTAMP + INTERVAL '30 days')
FROM users_with_excess_properties uep
WHERE profiles.id = uep.user_id
  AND (profiles.subscription_trial_ends_at IS NULL 
       OR profiles.subscription_trial_ends_at < CURRENT_TIMESTAMP);

-- Comentário explicativo
COMMENT ON COLUMN profiles.subscription_trial_ends_at IS 
  'Data de fim do período de teste gratuito. Usuários com mais de 2 imóveis recebem 30 dias de teste após a migração.';

