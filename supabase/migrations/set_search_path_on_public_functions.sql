-- Lote 1, tarefa 1.5 — aplicada em 2026-09-17.
--
-- Função sem search_path fixo resolve nomes pelo search_path de quem chama.
-- Em função SECURITY DEFINER isso é escalada de privilégio: basta criar um
-- schema com uma tabela de mesmo nome e colocá-lo na frente do public.
--
-- Todas as funções de public referenciam auth.* de forma qualificada, então
-- fixar `public, pg_temp` é seguro. Usa ALTER FUNCTION em vez de recriar cada
-- uma, para não repetir corpos de função só por causa de um atributo.
--
-- Cobriu as 9 funções de public; create_user_profile já tinha `search_path=public`
-- e foi normalizada para incluir pg_temp.

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
  end loop;
end
$$;
