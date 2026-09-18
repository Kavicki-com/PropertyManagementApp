-- Lote 1, tarefa 1.4 — aplicada em 2026-09-17.
--
-- anon não deve poder disparar o pipeline de notificações pela API REST.
--
-- Armadilha: o grant efetivo não vinha de `anon`, vinha de `PUBLIC` — na ACL
-- aparece como `=X/postgres`. Revogar só de anon não mudaria nada, porque anon
-- herda de PUBLIC. É preciso tirar de PUBLIC e regrantear quem realmente usa.
--
-- Pré-requisito: a tarefa 1.12 (crons lendo a chave service_role do Vault).
-- Feito na ordem inversa, o cron de notificações pararia de funcionar.

revoke execute on function public.check_all_notifications() from public, anon;
grant  execute on function public.check_all_notifications() to authenticated, service_role;

-- As duas v2 são chamadas apenas de dentro de check_all_notifications, que é
-- SECURITY DEFINER e executa como o dono. Ninguém precisa chamá-las direto.
revoke execute on function public.check_rent_notifications_v2(uuid) from public, anon, authenticated;
grant  execute on function public.check_rent_notifications_v2(uuid) to service_role;

revoke execute on function public.check_inactivity_notifications_v2() from public, anon, authenticated;
grant  execute on function public.check_inactivity_notifications_v2() to service_role;

revoke execute on function public.delete_user_account() from public, anon;
grant  execute on function public.delete_user_account() to authenticated, service_role;

-- create_user_profile NÃO perde o anon, de propósito.
--
-- A confirmação de e-mail está ligada (11 dos 13 usuários receberam o e-mail),
-- então supabase.auth.signUp() volta com session = null e o app chama essa RPC
-- como anon, em screens/SignUpScreen.js:388. Revogar aqui quebraria todo
-- cadastro novo. O lint de segurança do Supabase vai continuar apontando essa
-- função — é aceito conscientemente.
revoke execute on function public.create_user_profile(uuid, text, text, text, text, text, text, text, text, boolean, timestamp with time zone) from public;
grant  execute on function public.create_user_profile(uuid, text, text, text, text, text, text, text, text, boolean, timestamp with time zone) to anon, authenticated, service_role;
