-- RPC Function para deletar a conta do usuário autenticado
-- Esta função pode ser chamada via supabase.rpc('delete_user_account')
-- Ela usa auth.uid() para garantir que apenas o próprio usuário pode deletar sua conta

CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
  result JSON;
BEGIN
  -- Obtém o ID do usuário autenticado
  user_id := auth.uid();
  
  -- Verifica se o usuário está autenticado
  IF user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não autenticado'
    );
  END IF;

  -- Deleta o perfil da tabela profiles primeiro
  DELETE FROM public.profiles WHERE id = user_id;
  
  -- Deleta o usuário da tabela auth.users
  -- Nota: Isso requer permissões especiais. Se não funcionar, pode ser necessário
  -- usar uma Edge Function com service_role_key ou configurar permissões no Supabase
  DELETE FROM auth.users WHERE id = user_id;
  
  -- Se chegou aqui, a exclusão foi bem-sucedida
  RETURN json_build_object(
    'success', true,
    'message', 'Conta deletada com sucesso'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, retorna informações do erro
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Concede permissão para usuários autenticados executarem esta função
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;




