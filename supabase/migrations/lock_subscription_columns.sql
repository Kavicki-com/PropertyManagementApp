-- Impede que o app escreva as colunas de assinatura.
--
-- POR QUE ISSO É NECESSÁRIO
--
-- O Supabase expõe o banco diretamente na internet via PostgREST. A anon key
-- está dentro de todo app instalado (e no app.json), e a policy convencional de
-- profiles autoriza o usuário a editar a PRÓPRIA LINHA — a linha inteira, não
-- colunas específicas. Como o plano mora na mesma linha que nome e telefone,
-- qualquer pessoa com o app podia fazer:
--
--   PATCH /rest/v1/profiles?id=eq.<seu_uid>
--   {"subscription_plan":"premium","subscription_expires_at":"2030-01-01"}
--
-- ...e virar premium de graça, sem invadir nada. Só usando a API pública.
--
-- APLIQUE SÓ DEPOIS de implantar as Edge Functions e publicar a versão do app
-- que não escreve mais essas colunas. Numa versão antiga do app, uma compra
-- passaria a falhar em vez de conceder o plano.
--
-- Para reverter:  DROP TRIGGER protect_subscription_columns ON profiles;

CREATE OR REPLACE FUNCTION public.protect_subscription_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- PostgREST assume o papel 'authenticated' (ou 'anon') ao atender uma
  -- requisição vinda do app. As Edge Functions usam a service_role key, e o SQL
  -- Editor roda como postgres — esses passam direto.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- Não basta bloquear todo UPDATE: o app precisa continuar editando nome,
  -- telefone, foto. Só recusamos quando uma coluna de assinatura muda de fato.
  IF (NEW.subscription_plan                    IS DISTINCT FROM OLD.subscription_plan)
  OR (NEW.subscription_status                  IS DISTINCT FROM OLD.subscription_status)
  OR (NEW.subscription_started_at              IS DISTINCT FROM OLD.subscription_started_at)
  OR (NEW.subscription_expires_at              IS DISTINCT FROM OLD.subscription_expires_at)
  OR (NEW.subscription_iap_transaction_id      IS DISTINCT FROM OLD.subscription_iap_transaction_id)
  OR (NEW.subscription_trial_ends_at           IS DISTINCT FROM OLD.subscription_trial_ends_at)
  OR (NEW.subscription_grace_period_ends_at    IS DISTINCT FROM OLD.subscription_grace_period_ends_at)
  OR (NEW.subscription_receipt                 IS DISTINCT FROM OLD.subscription_receipt)
  OR (NEW.subscription_original_transaction_id IS DISTINCT FROM OLD.subscription_original_transaction_id)
  OR (NEW.subscription_auto_renew              IS DISTINCT FROM OLD.subscription_auto_renew)
  OR (NEW.subscription_environment             IS DISTINCT FROM OLD.subscription_environment)
  OR (NEW.subscription_product_id              IS DISTINCT FROM OLD.subscription_product_id)
  OR (NEW.subscription_last_verified_at        IS DISTINCT FROM OLD.subscription_last_verified_at)
  THEN
    RAISE EXCEPTION
      'Colunas de assinatura só podem ser alteradas pelo servidor após validação com a Apple'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_subscription_columns ON profiles;

CREATE TRIGGER protect_subscription_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_subscription_columns();

COMMENT ON FUNCTION public.protect_subscription_columns() IS
  'Recusa alteração das colunas de assinatura vinda do app (papéis authenticated/anon). Apenas as Edge Functions, com service_role, podem conceder plano — e só depois de validar o recibo com a Apple.';

-- CONFERIR SE FUNCIONOU
--
-- Como authenticated, isto deve falhar com insufficient_privilege:
--   SET LOCAL ROLE authenticated;
--   UPDATE profiles SET subscription_plan = 'premium' WHERE id = '<algum-uuid>';
--
-- E isto deve continuar passando (edição normal de perfil):
--   SET LOCAL ROLE authenticated;
--   UPDATE profiles SET full_name = 'Teste' WHERE id = '<algum-uuid>';
