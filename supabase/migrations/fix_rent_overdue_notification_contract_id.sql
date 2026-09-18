-- Lote 1, tarefa 1.1 — aplicada em 2026-09-17.
--
-- A regra de atraso (RULE 2) montava o `data` da notificação com screen,
-- tenantId e days_overdue, mas a dedup logo abaixo procurava por
-- `n.data->>'contract_id'`. Com a chave ausente a comparação virava
-- `NULL = '<uuid>'`, que nunca é verdadeira, então `existing_notification_id`
-- ficava NULL e um INSERT novo acontecia a cada execução do cron — de hora em
-- hora, para sempre. A regra de vencimento (RULE 1) não tinha o problema
-- porque o jsonb dela já carregava contract_id.
--
-- A correção é uma linha: 'contract_id', contract_record.contract_id no
-- jsonb_build_object da RULE 2. O resto da função é idêntico ao anterior.
--
-- Verificado depois de aplicar, em transação revertida: primeira execução de
-- check_all_notifications() cria 6 linhas, segunda cria 0.

CREATE OR REPLACE FUNCTION public.check_rent_notifications_v2(target_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(notification_id uuid, user_id uuid, type text, title text, body text, data jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  contract_record RECORD;
  today_date DATE;
  days_until_due INTEGER;
  next_due_date DATE;
  notification_type TEXT;
  notification_title TEXT;
  notification_body TEXT;
  notification_data JSONB;
  existing_notification_id UUID;
  temp_user_id UUID;
  temp_type TEXT;
  temp_title TEXT;
  temp_body TEXT;
  temp_data JSONB;
BEGIN
  today_date := CURRENT_DATE;

  -- Iterate over active contracts, optionally filtered by user
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
      AND (target_user_id IS NULL OR c.user_id = target_user_id)
  LOOP
    -- Calculate next due date
    next_due_date := DATE_TRUNC('month', today_date) + (contract_record.due_day - 1) * INTERVAL '1 day';

    -- If day passed this month, consider next month
    IF next_due_date < today_date THEN
      next_due_date := next_due_date + INTERVAL '1 month';
    END IF;

    days_until_due := next_due_date - today_date;

    -- RULE 1: Rent Due in 5 days -> Dashboard
    IF days_until_due = 5 THEN
      notification_type := 'rent_due_soon';
      notification_title := 'Aluguel vence em 5 dias';
      notification_body := 'O aluguel de ' || COALESCE(contract_record.property_address, 'um imóvel') || ' vence em 5 dias.';
      notification_data := jsonb_build_object(
        'screen', 'Dashboard',
        'contract_id', contract_record.contract_id
      );

      -- Check if exists today (using alias 'n')
      SELECT n.id INTO existing_notification_id
      FROM notifications n
      WHERE n.user_id = contract_record.user_id
        AND n.type = notification_type
        AND n.data->>'contract_id' = contract_record.contract_id::TEXT
        AND DATE(n.created_at) = today_date;

      IF existing_notification_id IS NULL THEN
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (contract_record.user_id, notification_type, notification_title, notification_body, notification_data)
        RETURNING id INTO notification_id;

        user_id := contract_record.user_id;
        type := notification_type;
        title := notification_title;
        body := notification_body;
        data := notification_data;
        RETURN NEXT;
      END IF;
    END IF;

    -- RULE 2: Overdue 1, 2, 3, 4, 5 days -> TenantDetails
    DECLARE
        current_month_due_date DATE;
        days_diff INTEGER;
        has_payment BOOLEAN;
        days_overdue INTEGER;
    BEGIN
        current_month_due_date := DATE_TRUNC('month', today_date) + (contract_record.due_day - 1) * INTERVAL '1 day';
        days_diff := today_date - current_month_due_date; -- Positive if past due

        -- If days_diff is between 1 and 5, it was due 1-5 days ago this month.
        IF days_diff >= 1 AND days_diff <= 5 THEN
            days_overdue := days_diff;

            -- Check if paid (using alias 'f')
            SELECT EXISTS(
              SELECT 1 FROM finances f
              WHERE f.tenant_id = contract_record.tenant_id
                AND f.type = 'income'
                AND DATE_TRUNC('month', f.date) = DATE_TRUNC('month', today_date)
            ) INTO has_payment;

            IF NOT has_payment THEN
                notification_type := 'rent_overdue';
                notification_title := 'Aluguel em atraso';
                notification_body := 'O aluguel de ' || COALESCE(contract_record.tenant_name, 'Inquilino') || ' está atrasado há ' || days_overdue || ' dias.';
                notification_data := jsonb_build_object(
                    'screen', 'TenantDetails',
                    'tenantId', contract_record.tenant_id,
                    'contract_id', contract_record.contract_id,
                    'days_overdue', days_overdue
                );

                -- Check exists today (using alias 'n')
                SELECT n.id INTO existing_notification_id
                FROM notifications n
                WHERE n.user_id = contract_record.user_id
                    AND n.type = notification_type
                    AND n.data->>'contract_id' = contract_record.contract_id::TEXT
                    AND n.data->>'days_overdue' = days_overdue::TEXT
                    AND DATE(n.created_at) = today_date;

                IF existing_notification_id IS NULL THEN
                    INSERT INTO notifications (user_id, type, title, body, data)
                    VALUES (contract_record.user_id, notification_type, notification_title, notification_body, notification_data)
                    RETURNING id INTO notification_id;

                    user_id := contract_record.user_id;
                    type := notification_type;
                    title := notification_title;
                    body := notification_body;
                    data := notification_data;
                    RETURN NEXT;
                END IF;
            END IF;
        END IF;
    END;

  END LOOP;
  RETURN;
END;
$function$;
