// lib/cepService.js
// Serviço para busca de endereço via CEP usando API ViaCEP

/**
 * Busca endereço completo a partir do CEP usando a API ViaCEP
 * @param {string} cep - CEP formatado ou não
 * @returns {Promise<object>} - Objeto com dados do endereço ou erro
 */
export const fetchAddressByCep = async (cep) => {
  try {
    const cleanCep = cep.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      return { error: 'CEP deve ter 8 dígitos' };
    }
    
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      return { error: 'Erro ao consultar CEP. Tente novamente.' };
    }
    
    const data = await response.json();
    
    if (data.erro) {
      return { error: 'CEP não encontrado' };
    }
    
    return {
      success: true,
      street: data.logradouro || '',
      neighborhood: data.bairro || '',
      city: data.localidade || '',
      state: data.uf || '',
    };
  } catch (error) {
    return { error: 'Erro de conexão. Verifique sua internet.' };
  }
};



