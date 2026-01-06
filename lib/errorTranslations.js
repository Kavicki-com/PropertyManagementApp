// lib/errorTranslations.js
// Função helper para traduzir mensagens de erro comuns do Supabase

/**
 * Traduz mensagens de erro comuns do Supabase para português
 * @param {string} errorMessage - Mensagem de erro original do Supabase
 * @returns {string} - Mensagem traduzida ou a original se não houver tradução
 */
export const translateSupabaseError = (errorMessage) => {
  if (!errorMessage || typeof errorMessage !== 'string') {
    return 'Ocorreu um erro. Tente novamente.';
  }

  const errorLower = errorMessage.toLowerCase();

  // Mapeamento de erros comuns do Supabase
  const errorTranslations = {
    // Erros de autenticação
    'email not confirmed': 'Email não confirmado',
    'invalid login credentials': 'Credenciais de login inválidas',
    'invalid credentials': 'Credenciais inválidas',
    'user already registered': 'Usuário já cadastrado',
    'already registered': 'Já cadastrado',
    'already exists': 'Já existe',
    'email rate limit exceeded': 'Limite de emails excedido. Tente novamente mais tarde.',
    'invalid email': 'Email inválido',
    'password': 'Erro na senha',
    'network': 'Erro de conexão. Verifique sua internet.',
    'network error': 'Erro de conexão. Verifique sua internet.',
    
    // Erros de banco de dados
    'foreign key constraint': 'Erro de relacionamento entre dados',
    'profiles_id_fkey': 'Erro ao vincular perfil',
    'duplicate key': 'Dado duplicado',
    'unique constraint': 'Este dado já existe',
    'not null constraint': 'Campo obrigatório não preenchido',
    'check constraint': 'Valor inválido para este campo',
    'column': 'Erro na estrutura do banco de dados',
    'function': 'Função não encontrada',
    'does not exist': 'Não encontrado',
    
    // Erros genéricos
    'could not fetch': 'Não foi possível buscar',
    'could not load': 'Não foi possível carregar',
    'could not save': 'Não foi possível salvar',
    'could not update': 'Não foi possível atualizar',
    'could not delete': 'Não foi possível excluir',
    'unable to': 'Não foi possível',
    'failed to': 'Falha ao',
    'error': 'Erro',
    'permission denied': 'Permissão negada',
    'unauthorized': 'Não autorizado',
    'forbidden': 'Acesso negado',
  };

  // Buscar tradução exata ou parcial
  for (const [key, translation] of Object.entries(errorTranslations)) {
    if (errorLower.includes(key)) {
      return translation;
    }
  }

  // Se não encontrou tradução, retorna a mensagem original
  // mas tenta melhorar mensagens muito técnicas
  if (errorLower.includes('violates') || errorLower.includes('constraint')) {
    return 'Erro ao salvar dados. Verifique se todos os campos estão corretos.';
  }

  return errorMessage;
};

/**
 * Traduz objeto de erro do Supabase
 * @param {Object} error - Objeto de erro do Supabase
 * @returns {string} - Mensagem traduzida
 */
export const translateSupabaseErrorObject = (error) => {
  if (!error) {
    return 'Ocorreu um erro. Tente novamente.';
  }

  // Priorizar error.message, depois error.error_description, depois error.msg
  const message = error.message || error.error_description || error.msg || 'Erro desconhecido';
  
  return translateSupabaseError(message);
};

