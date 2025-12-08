-- ============================================
-- SCRIPT PARA DISPARAR NOTIFICAÇÕES MANUALMENTE
-- ============================================
-- Este script permite criar notificações manualmente para testes
-- Use no SQL Editor do Supabase

-- ============================================
-- OPÇÃO 1: CRIAR NOTIFICAÇÃO MANUAL SIMPLES
-- ============================================

-- Substitua 'SEU_USER_ID' pelo ID do seu usuário
-- Para encontrar seu user_id, execute: SELECT id FROM auth.users;

-- Exemplo: Notificação de vencimento de aluguel
INSERT INTO notifications (user_id, type, title, body, data)
VALUES (
  'SEU_USER_ID_AQUI',  -- ⚠️ SUBSTITUA pelo seu user_id
  'rent_due',
  'Aluguel vence em 3 dias',
  'O aluguel do apartamento na Rua Exemplo, 123 (Inquilino: João Silva) no valor de R$ 1.800 vence em 3 dias.',
  jsonb_build_object(
    'contract_id', 'algum-id-de-contrato',
    'tenant_id', 'algum-id-de-inquilino',
    'property_id', 'algum-id-de-propriedade',
    'days_until_due', 3,
    'rent_amount', 1800
  )
)
RETURNING id, user_id, type, title, created_at;

-- ============================================
-- OPÇÃO 2: CRIAR MÚLTIPLAS NOTIFICAÇÕES DE TESTE
-- ============================================

-- Notificação de vencimento de aluguel (7 dias)
INSERT INTO notifications (user_id, type, title, body, data)
SELECT 
  id as user_id,  -- Usa o ID do usuário logado ou substitua
  'rent_due',
  'Aluguel vence em 7 dias',
  'O aluguel do seu imóvel no valor de R$ 2.500 vence em 7 dias. Lembre-se de cobrar o inquilino.',
  jsonb_build_object(
    'days_until_due', 7,
    'rent_amount', 2500
  )
FROM auth.users
WHERE id = 'SEU_USER_ID_AQUI'  -- ⚠️ SUBSTITUA pelo seu user_id
RETURNING id, title;

-- Notificação de fim de contrato
INSERT INTO notifications (user_id, type, title, body, data)
SELECT 
  id as user_id,
  'contract_ending',
  'Contrato termina em 30 dias',
  'O contrato de locação do seu imóvel termina em 30 dias. Considere renovar ou buscar novo inquilino.',
  jsonb_build_object(
    'days_until_end', 30
  )
FROM auth.users
WHERE id = 'SEU_USER_ID_AQUI'  -- ⚠️ SUBSTITUA pelo seu user_id
RETURNING id, title;

-- Notificação de atraso
INSERT INTO notifications (user_id, type, title, body, data)
SELECT 
  id as user_id,
  'rent_due',
  'Aluguel em atraso!',
  'O aluguel do seu imóvel no valor de R$ 1.800 está em atraso desde ontem. Entre em contato com o inquilino.',
  jsonb_build_object(
    'days_until_due', -1,
    'rent_amount', 1800
  )
FROM auth.users
WHERE id = 'SEU_USER_ID_AQUI'  -- ⚠️ SUBSTITUA pelo seu user_id
RETURNING id, title;

-- ============================================
-- OPÇÃO 3: CRIAR NOTIFICAÇÃO BASEADA EM CONTRATO REAL
-- ============================================

-- Cria notificação usando dados reais do primeiro contrato ativo
INSERT INTO notifications (user_id, type, title, body, data)
SELECT 
  c.user_id,
  'rent_due',
  'Aluguel vence hoje!',
  'O aluguel de ' || COALESCE(p.address, 'seu imóvel') || 
  ' (Inquilino: ' || COALESCE(t.full_name, 'N/A') || 
  ') no valor de R$ ' || TO_CHAR(c.rent_amount, 'FM999G999G999') || 
  ' vence hoje (dia ' || c.due_day || ').',
  jsonb_build_object(
    'contract_id', c.id,
    'tenant_id', c.tenant_id,
    'property_id', c.property_id,
    'days_until_due', 0,
    'rent_amount', c.rent_amount
  )
FROM contracts c
LEFT JOIN tenants t ON t.id = c.tenant_id
LEFT JOIN properties p ON p.id = c.property_id
WHERE c.status = 'active'
  AND c.user_id = 'SEU_USER_ID_AQUI'  -- ⚠️ SUBSTITUA pelo seu user_id
  AND c.due_day IS NOT NULL
  AND c.rent_amount IS NOT NULL
LIMIT 1
RETURNING id, title, body;

-- ============================================
-- OPÇÃO 4: DISPARAR VERIFICAÇÃO AUTOMÁTICA
-- ============================================

-- Esta opção usa as funções que já criamos para verificar
-- contratos e criar notificações automaticamente

-- Verifica todos os contratos e cria notificações se necessário
SELECT * FROM check_all_notifications();

-- Ou verifica apenas vencimentos de aluguel
SELECT * FROM check_and_create_rent_due_notifications();

-- Ou verifica apenas contratos próximos ao fim
SELECT * FROM check_and_create_contract_ending_notifications();

-- ============================================
-- OPÇÃO 5: CRIAR NOTIFICAÇÃO E ENVIAR PUSH IMEDIATAMENTE
-- ============================================

-- Esta função cria a notificação e retorna o ID para chamar a Edge Function
DO $$
DECLARE
  notification_uuid UUID;
  user_uuid UUID;
BEGIN
  -- Substitua pelo seu user_id
  user_uuid := 'SEU_USER_ID_AQUI'::UUID;  -- ⚠️ SUBSTITUA
  
  -- Cria a notificação
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    user_uuid,
    'rent_due',
    'Notificação de Teste',
    'Esta é uma notificação de teste criada manualmente. Se você recebeu isso, o sistema está funcionando!',
    jsonb_build_object(
      'test', true,
      'created_at', NOW()
    )
  )
  RETURNING id INTO notification_uuid;
  
  -- Mostra o ID da notificação criada
  RAISE NOTICE 'Notificação criada com ID: %', notification_uuid;
  
  -- Agora você pode chamar a Edge Function com este ID
  -- A função será chamada automaticamente pelo código do app
  -- ou você pode chamá-la manualmente via código/API
END $$;

-- ============================================
-- OPÇÃO 6: VERIFICAR NOTIFICAÇÕES CRIADAS
-- ============================================

-- Ver todas as notificações não lidas do usuário
SELECT 
  id,
  type,
  title,
  body,
  read,
  created_at,
  data
FROM notifications
WHERE user_id = 'SEU_USER_ID_AQUI'  -- ⚠️ SUBSTITUA pelo seu user_id
ORDER BY created_at DESC;

-- Ver notificações não lidas
SELECT 
  id,
  type,
  title,
  body,
  created_at
FROM notifications
WHERE user_id = 'SEU_USER_ID_AQUI'  -- ⚠️ SUBSTITUA pelo seu user_id
  AND read = false
ORDER BY created_at DESC;

-- Contar notificações por tipo
SELECT 
  type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE read = false) as nao_lidas
FROM notifications
WHERE user_id = 'SEU_USER_ID_AQUI'  -- ⚠️ SUBSTITUA pelo seu user_id
GROUP BY type;

-- ============================================
-- OPÇÃO 7: LIMPAR NOTIFICAÇÕES DE TESTE
-- ============================================

-- Deletar todas as notificações de teste (cuidado!)
-- DELETE FROM notifications 
-- WHERE data->>'test' = 'true';

-- Deletar notificações antigas (mais de 30 dias)
-- DELETE FROM notifications 
-- WHERE created_at < NOW() - INTERVAL '30 days';

-- Marcar todas as notificações como lidas
-- UPDATE notifications 
-- SET read = true 
-- WHERE user_id = 'SEU_USER_ID_AQUI' AND read = false;

-- ============================================
-- COMO ENCONTRAR SEU USER_ID
-- ============================================

-- Execute esta query para encontrar seu user_id:
SELECT 
  id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- Ou se você estiver logado, pode usar:
-- SELECT auth.uid() as meu_user_id;

-- ============================================
-- EXEMPLO COMPLETO DE USO
-- ============================================

-- 1. Encontre seu user_id:
-- SELECT id FROM auth.users WHERE email = 'seu-email@exemplo.com';

-- 2. Crie uma notificação de teste:
/*
INSERT INTO notifications (user_id, type, title, body, data)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'seu-email@exemplo.com'),
  'rent_due',
  'Teste de Notificação',
  'Se você recebeu esta notificação, o sistema está funcionando perfeitamente!',
  '{"test": true}'::jsonb
)
RETURNING id;
*/

-- 3. A notificação será enviada automaticamente quando:
--    - O app for aberto e chamar checkAndCreateNotifications()
--    - Ou você pode chamar a Edge Function manualmente com o ID retornado

-- ============================================
-- DICAS
-- ============================================

-- ✅ Sempre substitua 'SEU_USER_ID_AQUI' pelo seu user_id real
-- ✅ Use a Opção 4 para criar notificações baseadas em contratos reais
-- ✅ Use a Opção 1 para criar notificações de teste simples
-- ✅ Verifique se há tokens de push registrados antes de testar:
--    SELECT * FROM user_push_tokens WHERE user_id = 'SEU_USER_ID';
-- ✅ Para enviar push, a notificação precisa existir e o usuário precisa ter token registrado




