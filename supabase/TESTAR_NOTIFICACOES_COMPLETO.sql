-- ============================================
-- SCRIPT COMPLETO PARA TESTAR NOTIFICAÇÕES
-- ============================================
-- Execute este script passo a passo no SQL Editor do Supabase

-- ============================================
-- PASSO 1: Encontrar seu User ID
-- ============================================
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- ⚠️ ANOTE O user_id que aparece acima
-- Vamos chamá-lo de {MEU_USER_ID} nas próximas queries

-- ============================================
-- PASSO 2: Verificar se você tem token de push
-- ============================================
-- (Execute após substituir {MEU_USER_ID} pelo ID do PASSO 1)

SELECT 
  id,
  expo_push_token,
  device_id,
  created_at,
  updated_at
FROM user_push_tokens
WHERE user_id = '{MEU_USER_ID}';  -- ⚠️ SUBSTITUA

-- ⚠️ Se não aparecer nenhum resultado, você precisa:
-- 1. Abrir o app no seu dispositivo (com build de desenvolvimento)
-- 2. Fazer login
-- 3. O app vai registrar o token automaticamente

-- ============================================
-- PASSO 3: Criar notificação de teste
-- ============================================
-- (Execute após substituir {MEU_USER_ID} pelo ID do PASSO 1)

INSERT INTO notifications (user_id, type, title, body, data)
VALUES (
  '{MEU_USER_ID}'::UUID,  -- ⚠️ SUBSTITUA pelo seu user_id
  'rent_due',
  '🧪 Notificação de Teste',
  'Esta é uma notificação de teste! Se você recebeu isso no seu celular, o sistema está funcionando perfeitamente! 🎉',
  jsonb_build_object(
    'test', true,
    'manual', true,
    'created_at', NOW()::text
  )
)
RETURNING 
  id as notification_id,
  user_id,
  type,
  title,
  body,
  created_at;

-- ⚠️ ANOTE O notification_id que aparece acima

-- ============================================
-- PASSO 4: Verificar se notificação foi criada
-- ============================================

SELECT 
  id,
  type,
  title,
  body,
  read,
  created_at
FROM notifications
WHERE user_id = '{MEU_USER_ID}'  -- ⚠️ SUBSTITUA
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- PASSO 5: Disparar verificação automática
-- ============================================
-- Cria notificações baseadas nos seus contratos reais

SELECT 
  notification_id,
  user_id,
  type,
  title,
  body
FROM check_all_notifications()
WHERE user_id = '{MEU_USER_ID}';  -- ⚠️ SUBSTITUA

-- ============================================
-- PASSO 6: Criar notificação baseada em contrato real
-- ============================================
-- (Funciona se você tiver contratos ativos)

INSERT INTO notifications (user_id, type, title, body, data)
SELECT 
  c.user_id,
  'rent_due',
  '💰 Aluguel vence em 7 dias',
  'O aluguel de ' || COALESCE(p.address, 'seu imóvel') || 
  ' (Inquilino: ' || COALESCE(t.full_name, 'N/A') || 
  ') no valor de R$ ' || TO_CHAR(c.rent_amount, 'FM999G999G999') || 
  ' vence em 7 dias (dia ' || c.due_day || ').',
  jsonb_build_object(
    'contract_id', c.id,
    'tenant_id', c.tenant_id,
    'property_id', c.property_id,
    'days_until_due', 7,
    'rent_amount', c.rent_amount,
    'manual_test', true
  )
FROM contracts c
LEFT JOIN tenants t ON t.id = c.tenant_id
LEFT JOIN properties p ON p.id = c.property_id
WHERE c.status = 'active'
  AND c.user_id = '{MEU_USER_ID}'  -- ⚠️ SUBSTITUA
  AND c.due_day IS NOT NULL
  AND c.rent_amount IS NOT NULL
LIMIT 1
RETURNING id, title, body;

-- ============================================
-- PASSO 7: Ver todas as notificações criadas
-- ============================================

SELECT 
  n.id,
  n.type,
  n.title,
  n.body,
  n.read,
  n.created_at,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_push_tokens upt
      WHERE upt.user_id = n.user_id
      LIMIT 1
    ) THEN '✅'
    ELSE '⚠️ Sem token'
  END as pode_enviar_push
FROM notifications n
WHERE n.user_id = '{MEU_USER_ID}'  -- ⚠️ SUBSTITUA
ORDER BY n.created_at DESC;

-- ============================================
-- PASSO 8: Limpar notificações de teste (opcional)
-- ============================================

-- Descomente para deletar notificações de teste:
/*
DELETE FROM notifications 
WHERE user_id = '{MEU_USER_ID}'  -- ⚠️ SUBSTITUA
  AND data->>'test' = 'true';
*/

-- Ou marcar como lidas:
/*
UPDATE notifications 
SET read = true 
WHERE user_id = '{MEU_USER_ID}'  -- ⚠️ SUBSTITUA
  AND read = false;
*/

-- ============================================
-- CHECKLIST DE TESTE
-- ============================================

/*
✅ PASSO 1: Encontrei meu user_id
✅ PASSO 2: Verifiquei se tenho token de push (se não, abrir app primeiro)
✅ PASSO 3: Criei notificação de teste
✅ PASSO 4: Verifiquei que notificação foi criada
✅ PASSO 5: Disparei verificação automática
✅ PASSO 6: (Opcional) Criei notificação baseada em contrato real
✅ PASSO 7: Vi todas as notificações criadas

Para receber a notificação:
1. Abra o app no seu dispositivo (com build de desenvolvimento)
2. O app vai buscar notificações não lidas
3. Se você tiver token registrado, a push será enviada
4. A notificação aparecerá no seu dispositivo!
*/




