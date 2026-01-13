-- delete_test_data.sql
-- Removes the test Property, Tenant, and Contract created by propert_test_data.sql

DO $$
BEGIN
  -- Delete contracts for the test tenant
  DELETE FROM contracts 
  WHERE tenant_id IN (SELECT id FROM tenants WHERE full_name = 'Test Tenant (Auto-Gen)');

  -- Delete the test tenant
  DELETE FROM tenants WHERE full_name = 'Test Tenant (Auto-Gen)';

  -- Delete the test property
  DELETE FROM properties WHERE address = 'Test Property (Auto-Gen)';

  -- Optionally delete the generated notifications (so you can re-test)
  DELETE FROM notifications 
  WHERE title = 'Aluguel vence em 5 dias' AND body LIKE '%Test Property (Auto-Gen)%';

  RAISE NOTICE 'Test data cleaned up.';
END $$;
