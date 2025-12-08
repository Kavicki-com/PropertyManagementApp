-- ============================================
-- VERIFICAR CONTRATOS E DISPARAR NOTIFICAÇÕES
-- ============================================
-- Este script verifica todos os contratos ativos e cria
-- notificações automaticamente se necessário

-- Verifica e cria notificações de vencimento de aluguel
SELECT 
  notification_id,
  user_id,
  type,
  title,
  body
FROM check_and_create_rent_due_notifications();

-- Verifica e cria notificações de contratos próximos ao fim
SELECT 
  notification_id,
  user_id,
  type,
  title,
  body
FROM check_and_create_contract_ending_notifications();

-- Verifica TUDO de uma vez (ambos os tipos)
SELECT 
  notification_id,
  user_id,
  type,
  title,
  body
FROM check_all_notifications();

-- Ver quantas notificações foram criadas agora
WITH novas_notificacoes AS (
  SELECT * FROM check_all_notifications()
)
SELECT 
  type,
  COUNT(*) as total_criadas
FROM novas_notificacoes
GROUP BY type;

-- ============================================
-- EXEMPLO: VERIFICAR E VER RESULTADO
-- ============================================

-- Esta query cria notificações e mostra o resultado completo
SELECT 
  n.id as notification_id,
  n.user_id,
  n.type,
  n.title,
  n.body,
  n.data,
  n.created_at,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_push_tokens 
      WHERE user_id = n.user_id
    ) THEN '✅ Tem token - Push será enviado'
    ELSE '⚠️ Sem token - Push não será enviado'
  END as status_push
FROM check_all_notifications() c
JOIN notifications n ON n.id = c.notification_id
ORDER BY n.created_at DESC;




