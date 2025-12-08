-- ============================================
-- DISPARAR NOTIFICAÇÃO RÁPIDA - TESTE SIMPLES
-- ============================================
-- Copie e cole no SQL Editor do Supabase
-- Substitua 'SEU_USER_ID_AQUI' pelo seu user_id

-- PASSO 1: Encontre seu user_id (execute esta query primeiro)
SELECT id, email FROM auth.users ORDER BY created_at DESC;

-- PASSO 2: Crie uma notificação de teste (substitua o user_id)
INSERT INTO notifications (user_id, type, title, body, data)
VALUES (
  'SEU_USER_ID_AQUI',  -- ⚠️ SUBSTITUA pelo ID encontrado no PASSO 1
  'rent_due',
  '🧪 Notificação de Teste',
  'Se você recebeu esta notificação, o sistema está funcionando perfeitamente! 🎉',
  jsonb_build_object(
    'test', true,
    'created_at', NOW()::text
  )
)
RETURNING id, title, created_at;

-- PASSO 3: Verifique se você tem token de push registrado
-- (A notificação só será enviada se você tiver um token)
SELECT * FROM user_push_tokens 
WHERE user_id = 'SEU_USER_ID_AQUI';  -- ⚠️ SUBSTITUA pelo seu user_id

-- PASSO 4: Para enviar push, abra o app no seu dispositivo
-- O app verifica notificações não enviadas quando abre




