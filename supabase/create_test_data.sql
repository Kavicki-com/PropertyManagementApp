-- create_test_data.sql
-- Creates a test Property, Tenant, and Contract (Due in 5 days) to trigger a notification.

DO $$
DECLARE
  v_user_id UUID;
  v_property_id UUID;
  v_tenant_id UUID;
  v_due_day INTEGER;
BEGIN
  -- 1. Get the first user in the system to assign data to
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found in auth.users. Please create a user first.';
  END IF;

  -- 2. Create Test Property
  INSERT INTO properties (user_id, address, city, state, zip_code, rent_amount)
  VALUES (v_user_id, 'Test Property (Auto-Gen)', 'Test City', 'TS', '12345', 1500)
  RETURNING id INTO v_property_id;

  -- 3. Create Test Tenant
  INSERT INTO tenants (user_id, full_name, email, phone)
  VALUES (v_user_id, 'Test Tenant (Auto-Gen)', 'test@example.com', '5511999999999')
  RETURNING id INTO v_tenant_id;

  -- 4. Create Contract (Due Day = Today + 5 days)
  -- This triggers the 'Rent Due in 5 Days' rule
  v_due_day := EXTRACT(DAY FROM (CURRENT_DATE + INTERVAL '5 days'));

  INSERT INTO contracts (
    user_id, tenant_id, property_id, 
    start_date, end_date, 
    rent_amount, due_day, 
    status
  )
  VALUES (
    v_user_id, v_tenant_id, v_property_id,
    CURRENT_DATE, (CURRENT_DATE + INTERVAL '1 year'),
    1500, v_due_day,
    'active'
  );

  RAISE NOTICE 'Test data created successfully for User ID: %', v_user_id;
  RAISE NOTICE 'Contract created with Due Day: % (Triggers 5-day rule)', v_due_day;

END $$;
