-- Sistema de Notificações - Vencimentos e Contratos
-- Este arquivo cria todas as estruturas necessárias para o sistema de notificações

-- ============================================
-- 1. TABELA: user_push_tokens
-- Armazena tokens Expo Push de cada dispositivo
-- ============================================
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  device_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, expo_push_token)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_token ON user_push_tokens(expo_push_token);

-- RLS (Row Level Security)
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push tokens"
  ON user_push_tokens
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- 2. TABELA: notifications
-- Armazena histórico de notificações
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('rent_due', 'contract_ending')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- 3. FUNÇÃO: check_and_create_rent_due_notifications
-- Verifica vencimentos de aluguel e cria notificações
-- ============================================
CREATE OR REPLACE FUNCTION check_and_create_rent_due_notifications()
RETURNS TABLE (
  notification_id UUID,
  user_id UUID,
  type TEXT,
  title TEXT,
  body TEXT
) AS $$
DECLARE
  contract_record RECORD;
  today_date DATE;
  due_date DATE;
  days_until_due INTEGER;
  next_due_date DATE;
  notification_type TEXT;
  notification_title TEXT;
  notification_body TEXT;
  existing_notification_id UUID;
  temp_user_id UUID;
  temp_type TEXT;
  temp_title TEXT;
  temp_body TEXT;
BEGIN
  today_date := CURRENT_DATE;

  -- Itera sobre todos os contratos ativos
  FOR contract_record IN
    SELECT 
      c.id as contract_id,
      c.user_id,
      c.tenant_id,
      c.property_id,
      c.due_day,
      c.rent_amount,
      t.full_name as tenant_name,
      p.address as property_address
    FROM contracts c
    LEFT JOIN tenants t ON t.id = c.tenant_id
    LEFT JOIN properties p ON p.id = c.property_id
    WHERE c.status = 'active'
      AND c.due_day IS NOT NULL
      AND c.rent_amount IS NOT NULL
  LOOP
    -- Calcula o próximo vencimento baseado no due_day do mês atual
    next_due_date := DATE_TRUNC('month', today_date) + (contract_record.due_day - 1) * INTERVAL '1 day';
    
    -- Se o dia já passou este mês, considera o próximo mês
    IF next_due_date < today_date THEN
      next_due_date := next_due_date + INTERVAL '1 month';
    END IF;

    days_until_due := next_due_date - today_date;

    -- Verifica se precisa criar notificação para 7 dias antes
    IF days_until_due = 7 THEN
      notification_type := 'rent_due';
      notification_title := 'Aluguel vence em 7 dias';
      notification_body := 'O aluguel de ' || COALESCE(contract_record.property_address, 'seu imóvel') || 
                          ' (Inquilino: ' || COALESCE(contract_record.tenant_name, 'N/A') || 
                          ') no valor de R$ ' || TO_CHAR(contract_record.rent_amount, 'FM999G999G999') || 
                          ' vence em 7 dias (dia ' || contract_record.due_day || ').';
      
      -- Verifica se já existe notificação similar hoje
      SELECT id INTO existing_notification_id
      FROM notifications
      WHERE user_id = contract_record.user_id
        AND type = notification_type
        AND data->>'contract_id' = contract_record.contract_id::TEXT
        AND data->>'days_until_due' = '7'
        AND DATE(created_at) = today_date;
      
      IF existing_notification_id IS NULL THEN
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          contract_record.user_id,
          notification_type,
          notification_title,
          notification_body,
          jsonb_build_object(
            'contract_id', contract_record.contract_id,
            'tenant_id', contract_record.tenant_id,
            'property_id', contract_record.property_id,
            'days_until_due', 7,
            'rent_amount', contract_record.rent_amount
          )
        )
        RETURNING id, user_id, type, title, body 
        INTO notification_id, temp_user_id, temp_type, temp_title, temp_body;
        
        user_id := temp_user_id;
        type := temp_type;
        title := temp_title;
        body := temp_body;
        
        RETURN NEXT;
      END IF;
    END IF;

    -- Verifica se precisa criar notificação para 3 dias antes
    IF days_until_due = 3 THEN
      notification_type := 'rent_due';
      notification_title := 'Aluguel vence em 3 dias';
      notification_body := 'O aluguel de ' || COALESCE(contract_record.property_address, 'seu imóvel') || 
                          ' (Inquilino: ' || COALESCE(contract_record.tenant_name, 'N/A') || 
                          ') no valor de R$ ' || TO_CHAR(contract_record.rent_amount, 'FM999G999G999') || 
                          ' vence em 3 dias (dia ' || contract_record.due_day || ').';
      
      SELECT id INTO existing_notification_id
      FROM notifications
      WHERE user_id = contract_record.user_id
        AND type = notification_type
        AND data->>'contract_id' = contract_record.contract_id::TEXT
        AND data->>'days_until_due' = '3'
        AND DATE(created_at) = today_date;
      
      IF existing_notification_id IS NULL THEN
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          contract_record.user_id,
          notification_type,
          notification_title,
          notification_body,
          jsonb_build_object(
            'contract_id', contract_record.contract_id,
            'tenant_id', contract_record.tenant_id,
            'property_id', contract_record.property_id,
            'days_until_due', 3,
            'rent_amount', contract_record.rent_amount
          )
        )
        RETURNING id, user_id, type, title, body 
        INTO notification_id, temp_user_id, temp_type, temp_title, temp_body;
        
        user_id := temp_user_id;
        type := temp_type;
        title := temp_title;
        body := temp_body;
        
        RETURN NEXT;
      END IF;
    END IF;

    -- Verifica se precisa criar notificação no dia do vencimento
    IF days_until_due = 0 THEN
      notification_type := 'rent_due';
      notification_title := 'Aluguel vence hoje!';
      notification_body := 'O aluguel de ' || COALESCE(contract_record.property_address, 'seu imóvel') || 
                          ' (Inquilino: ' || COALESCE(contract_record.tenant_name, 'N/A') || 
                          ') no valor de R$ ' || TO_CHAR(contract_record.rent_amount, 'FM999G999G999') || 
                          ' vence hoje (dia ' || contract_record.due_day || ').';
      
      SELECT id INTO existing_notification_id
      FROM notifications
      WHERE user_id = contract_record.user_id
        AND type = notification_type
        AND data->>'contract_id' = contract_record.contract_id::TEXT
        AND data->>'days_until_due' = '0'
        AND DATE(created_at) = today_date;
      
      IF existing_notification_id IS NULL THEN
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          contract_record.user_id,
          notification_type,
          notification_title,
          notification_body,
          jsonb_build_object(
            'contract_id', contract_record.contract_id,
            'tenant_id', contract_record.tenant_id,
            'property_id', contract_record.property_id,
            'days_until_due', 0,
            'rent_amount', contract_record.rent_amount
          )
        )
        RETURNING id, user_id, type, title, body 
        INTO notification_id, temp_user_id, temp_type, temp_title, temp_body;
        
        user_id := temp_user_id;
        type := temp_type;
        title := temp_title;
        body := temp_body;
        
        RETURN NEXT;
      END IF;
    END IF;

    -- Verifica atraso (1 dia após vencimento, se não houver pagamento registrado)
    IF days_until_due = -1 THEN
      -- Verifica se há pagamento registrado no mês atual
      DECLARE
        has_payment BOOLEAN;
      BEGIN
        SELECT EXISTS(
          SELECT 1
          FROM finances f
          WHERE f.tenant_id = contract_record.tenant_id
            AND f.type = 'income'
            AND DATE_TRUNC('month', f.date) = DATE_TRUNC('month', today_date)
        ) INTO has_payment;

        IF NOT has_payment THEN
          notification_type := 'rent_due';
          notification_title := 'Aluguel em atraso!';
          notification_body := 'O aluguel de ' || COALESCE(contract_record.property_address, 'seu imóvel') || 
                            ' (Inquilino: ' || COALESCE(contract_record.tenant_name, 'N/A') || 
                            ') no valor de R$ ' || TO_CHAR(contract_record.rent_amount, 'FM999G999G999') || 
                            ' está em atraso desde ontem (dia ' || contract_record.due_day || ').';
          
          SELECT id INTO existing_notification_id
          FROM notifications
          WHERE user_id = contract_record.user_id
            AND type = notification_type
            AND data->>'contract_id' = contract_record.contract_id::TEXT
            AND data->>'days_until_due' = '-1'
            AND DATE(created_at) = today_date;
          
          IF existing_notification_id IS NULL THEN
            INSERT INTO notifications (user_id, type, title, body, data)
            VALUES (
              contract_record.user_id,
              notification_type,
              notification_title,
              notification_body,
              jsonb_build_object(
                'contract_id', contract_record.contract_id,
                'tenant_id', contract_record.tenant_id,
                'property_id', contract_record.property_id,
                'days_until_due', -1,
                'rent_amount', contract_record.rent_amount
              )
            )
            RETURNING id, user_id, type, title, body 
            INTO notification_id, temp_user_id, temp_type, temp_title, temp_body;
            
            user_id := temp_user_id;
            type := temp_type;
            title := temp_title;
            body := temp_body;
            
            RETURN NEXT;
          END IF;
        END IF;
      END;
    END IF;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. FUNÇÃO: check_and_create_contract_ending_notifications
-- Verifica contratos próximos ao fim e cria notificações
-- ============================================
CREATE OR REPLACE FUNCTION check_and_create_contract_ending_notifications()
RETURNS TABLE (
  notification_id UUID,
  user_id UUID,
  type TEXT,
  title TEXT,
  body TEXT
) AS $$
DECLARE
  contract_record RECORD;
  today_date DATE;
  days_until_end INTEGER;
  notification_type TEXT;
  notification_title TEXT;
  notification_body TEXT;
  existing_notification_id UUID;
  temp_user_id UUID;
  temp_type TEXT;
  temp_title TEXT;
  temp_body TEXT;
BEGIN
  today_date := CURRENT_DATE;

  -- Itera sobre todos os contratos ativos com end_date definido
  FOR contract_record IN
    SELECT 
      c.id as contract_id,
      c.user_id,
      c.tenant_id,
      c.property_id,
      c.end_date,
      t.full_name as tenant_name,
      p.address as property_address
    FROM contracts c
    LEFT JOIN tenants t ON t.id = c.tenant_id
    LEFT JOIN properties p ON p.id = c.property_id
    WHERE c.status = 'active'
      AND c.end_date IS NOT NULL
  LOOP
    days_until_end := contract_record.end_date::DATE - today_date;

    -- Verifica se precisa criar notificação para 30 dias antes
    IF days_until_end = 30 THEN
      notification_type := 'contract_ending';
      notification_title := 'Contrato termina em 30 dias';
      notification_body := 'O contrato de locação de ' || COALESCE(contract_record.property_address, 'seu imóvel') || 
                          ' (Inquilino: ' || COALESCE(contract_record.tenant_name, 'N/A') || 
                          ') termina em 30 dias (em ' || TO_CHAR(contract_record.end_date::DATE, 'DD/MM/YYYY') || ').';
      
      SELECT id INTO existing_notification_id
      FROM notifications
      WHERE user_id = contract_record.user_id
        AND type = notification_type
        AND data->>'contract_id' = contract_record.contract_id::TEXT
        AND data->>'days_until_end' = '30'
        AND DATE(created_at) = today_date;
      
      IF existing_notification_id IS NULL THEN
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          contract_record.user_id,
          notification_type,
          notification_title,
          notification_body,
          jsonb_build_object(
            'contract_id', contract_record.contract_id,
            'tenant_id', contract_record.tenant_id,
            'property_id', contract_record.property_id,
            'days_until_end', 30,
            'end_date', contract_record.end_date
          )
        )
        RETURNING id, user_id, type, title, body 
        INTO notification_id, temp_user_id, temp_type, temp_title, temp_body;
        
        user_id := temp_user_id;
        type := temp_type;
        title := temp_title;
        body := temp_body;
        
        RETURN NEXT;
      END IF;
    END IF;

    -- Verifica se precisa criar notificação para 7 dias antes
    IF days_until_end = 7 THEN
      notification_type := 'contract_ending';
      notification_title := 'Contrato termina em 7 dias';
      notification_body := 'O contrato de locação de ' || COALESCE(contract_record.property_address, 'seu imóvel') || 
                          ' (Inquilino: ' || COALESCE(contract_record.tenant_name, 'N/A') || 
                          ') termina em 7 dias (em ' || TO_CHAR(contract_record.end_date::DATE, 'DD/MM/YYYY') || ').';
      
      SELECT id INTO existing_notification_id
      FROM notifications
      WHERE user_id = contract_record.user_id
        AND type = notification_type
        AND data->>'contract_id' = contract_record.contract_id::TEXT
        AND data->>'days_until_end' = '7'
        AND DATE(created_at) = today_date;
      
      IF existing_notification_id IS NULL THEN
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          contract_record.user_id,
          notification_type,
          notification_title,
          notification_body,
          jsonb_build_object(
            'contract_id', contract_record.contract_id,
            'tenant_id', contract_record.tenant_id,
            'property_id', contract_record.property_id,
            'days_until_end', 7,
            'end_date', contract_record.end_date
          )
        )
        RETURNING id, user_id, type, title, body 
        INTO notification_id, temp_user_id, temp_type, temp_title, temp_body;
        
        user_id := temp_user_id;
        type := temp_type;
        title := temp_title;
        body := temp_body;
        
        RETURN NEXT;
      END IF;
    END IF;

    -- Verifica se contrato expirou (após end_date)
    IF days_until_end < 0 THEN
      notification_type := 'contract_ending';
      notification_title := 'Contrato expirado';
      notification_body := 'O contrato de locação de ' || COALESCE(contract_record.property_address, 'seu imóvel') || 
                          ' (Inquilino: ' || COALESCE(contract_record.tenant_name, 'N/A') || 
                          ') expirou em ' || TO_CHAR(contract_record.end_date::DATE, 'DD/MM/YYYY') || '.';
      
      SELECT id INTO existing_notification_id
      FROM notifications
      WHERE user_id = contract_record.user_id
        AND type = notification_type
        AND data->>'contract_id' = contract_record.contract_id::TEXT
        AND data->>'days_until_end' LIKE '-%'
        AND DATE(created_at) = today_date;
      
      IF existing_notification_id IS NULL THEN
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          contract_record.user_id,
          notification_type,
          notification_title,
          notification_body,
          jsonb_build_object(
            'contract_id', contract_record.contract_id,
            'tenant_id', contract_record.tenant_id,
            'property_id', contract_record.property_id,
            'days_until_end', days_until_end,
            'end_date', contract_record.end_date
          )
        )
        RETURNING id, user_id, type, title, body 
        INTO notification_id, temp_user_id, temp_type, temp_title, temp_body;
        
        user_id := temp_user_id;
        type := temp_type;
        title := temp_title;
        body := temp_body;
        
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. FUNÇÃO: check_all_notifications (wrapper)
-- Função simplificada que verifica tudo de uma vez
-- ============================================
CREATE OR REPLACE FUNCTION check_all_notifications()
RETURNS TABLE (
  notification_id UUID,
  user_id UUID,
  type TEXT,
  title TEXT,
  body TEXT
) AS $$
BEGIN
  -- Verifica vencimentos de aluguel
  RETURN QUERY SELECT * FROM check_and_create_rent_due_notifications();
  
  -- Verifica contratos próximos ao fim
  RETURN QUERY SELECT * FROM check_and_create_contract_ending_notifications();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. TRIGGER: Atualizar updated_at em user_push_tokens
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_push_tokens_updated_at
  BEFORE UPDATE ON user_push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();




