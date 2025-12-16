// lib/validation.js
// Utilitário de validação reutilizável para formulários

/**
 * Valida CPF usando o algoritmo de dígitos verificadores (Módulo 11)
 * @param {string} cpf - CPF formatado ou não (ex: "123.456.789-00" ou "12345678900")
 * @returns {boolean} - true se o CPF é válido, false caso contrário
 */
export const isValidCPF = (cpf) => {
  if (typeof cpf !== 'string') return false;
  
  // Remove caracteres não numéricos
  cpf = cpf.replace(/[^\d]+/g, '');
  
  // Verifica se tem 11 dígitos
  if (cpf.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais (ex: 111.111.111-11)
  if (!!cpf.match(/(\d)\1{10}/)) return false;
  
  // Validação do primeiro dígito verificador
  let soma = 0;
  let resto;
  
  for (let i = 1; i <= 9; i++) {
    soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  
  // Validação do segundo dígito verificador
  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma = soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }
  resto = (soma * 10) % 11;
  
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;
  
  return true;
};

/**
 * Valida email com regras mais robustas
 * @param {string} email - Email a ser validado
 * @returns {boolean} - true se o email é válido, false caso contrário
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  
  const trimmed = email.trim().toLowerCase();
  
  // Regex mais completa para validação de email
  // - Permite letras, números, pontos, hífens e underscores antes do @
  // - Domínio deve ter pelo menos um ponto
  // - Extensão deve ter entre 2 e 10 caracteres
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,10}$/;
  
  if (!emailRegex.test(trimmed)) return false;
  
  // Validações adicionais
  if (trimmed.length > 254) return false; // RFC 5321
  if (trimmed.split('@')[0].length > 64) return false; // RFC 5321
  
  // Verifica se não tem pontos consecutivos
  if (trimmed.includes('..')) return false;
  
  // Verifica se não começa ou termina com ponto na parte local
  const localPart = trimmed.split('@')[0];
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  
  return true;
};

/**
 * Valida senha com requisitos de segurança
 * Requisitos: mínimo 8 caracteres + 1 caractere especial
 * @param {string} password - Senha a ser validada
 * @returns {object} - { isValid: boolean, errors: string[] }
 */
export const validatePassword = (password) => {
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    return { isValid: false, errors: ['Senha é obrigatória'] };
  }
  
  // Verifica comprimento mínimo (8 caracteres)
  if (password.length < 8) {
    errors.push('A senha deve ter no mínimo 8 caracteres');
  }
  
  // Verifica se tem pelo menos uma letra ou número
  if (!/[a-zA-Z0-9]/.test(password)) {
    errors.push('A senha deve conter letras ou números');
  }
  
  // Verifica se tem pelo menos 1 caractere especial
  // Caracteres especiais: !@#$%^&*()_+-=[]{}|;':",.<>?/`~\
  const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;
  if (!specialCharRegex.test(password)) {
    errors.push('A senha deve conter pelo menos 1 caractere especial (!@#$%^&*...)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Verifica se a senha é válida (versão simplificada)
 * @param {string} password - Senha a ser validada
 * @returns {boolean} - true se a senha é válida, false caso contrário
 */
export const isValidPassword = (password) => {
  return validatePassword(password).isValid;
};

/**
 * Retorna a força da senha (fraca, média, forte)
 * @param {string} password - Senha a ser avaliada
 * @returns {object} - { strength: 'weak'|'medium'|'strong', score: number, label: string }
 */
export const getPasswordStrength = (password) => {
  if (!password || typeof password !== 'string') {
    return { strength: 'weak', score: 0, label: 'Muito fraca' };
  }
  
  let score = 0;
  
  // Comprimento
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  
  // Tipos de caracteres
  if (/[a-z]/.test(password)) score += 1; // minúsculas
  if (/[A-Z]/.test(password)) score += 1; // maiúsculas
  if (/[0-9]/.test(password)) score += 1; // números
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) score += 2; // especiais
  
  // Penalidades
  if (/^[a-zA-Z]+$/.test(password)) score -= 1; // apenas letras
  if (/^[0-9]+$/.test(password)) score -= 2; // apenas números
  if (/(.)\1{2,}/.test(password)) score -= 1; // caracteres repetidos (3+)
  
  // Classificação
  if (score <= 2) {
    return { strength: 'weak', score, label: 'Fraca' };
  } else if (score <= 5) {
    return { strength: 'medium', score, label: 'Média' };
  } else {
    return { strength: 'strong', score, label: 'Forte' };
  }
};

/**
 * Valida telefone brasileiro (10 ou 11 dígitos)
 * @param {string} phone - Telefone formatado ou não
 * @returns {boolean} - true se o telefone é válido, false caso contrário
 */
export const isValidPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const numbers = phone.replace(/\D/g, '');
  return numbers.length >= 10 && numbers.length <= 11;
};

/**
 * Valida número inteiro positivo com limites
 * @param {string|number} value - Valor a ser validado
 * @param {object} options - Opções de validação
 * @param {number} options.min - Valor mínimo (padrão: 0)
 * @param {number} options.max - Valor máximo (padrão: Infinity)
 * @returns {boolean} - true se o valor é válido, false caso contrário
 */
export const isValidInteger = (value, options = {}) => {
  const { min = 0, max = Infinity } = options;
  
  if (value === null || value === undefined || value === '') return false;
  
  const num = typeof value === 'string' ? parseInt(value.replace(/[^0-9]/g, ''), 10) : parseInt(value, 10);
  
  if (isNaN(num)) return false;
  if (num < min) return false;
  if (num > max) return false;
  
  return true;
};

/**
 * Valida valor monetário (decimal positivo)
 * @param {string|number} value - Valor a ser validado
 * @param {object} options - Opções de validação
 * @param {number} options.min - Valor mínimo (padrão: 0)
 * @param {number} options.max - Valor máximo (padrão: Infinity)
 * @returns {boolean} - true se o valor é válido, false caso contrário
 */
export const isValidMoney = (value, options = {}) => {
  const { min = 0, max = Infinity } = options;
  
  if (value === null || value === undefined || value === '') return false;
  
  // Remove caracteres não numéricos exceto ponto e vírgula
  const cleaned = typeof value === 'string' 
    ? value.replace(/[^\d,.-]/g, '').replace(',', '.') 
    : String(value);
  
  const num = parseFloat(cleaned);
  
  if (isNaN(num)) return false;
  if (num < min) return false;
  if (num > max) return false;
  
  return true;
};

/**
 * Converte string monetária para número (float)
 * @param {string} value - Valor formatado (ex: "1.800,50" ou "1800.50")
 * @returns {number} - Valor numérico ou NaN se inválido
 */
export const parseMoney = (value) => {
  if (!value || typeof value !== 'string') return NaN;
  
  // Remove caracteres não numéricos exceto ponto e vírgula
  const cleaned = value.replace(/[^\d,.-]/g, '');
  
  // Se tem vírgula, assume formato brasileiro (1.800,50)
  // Se tem ponto, assume formato internacional (1800.50)
  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Formato brasileiro: ponto para milhar, vírgula para decimal
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    // Apenas vírgula: pode ser decimal brasileiro
    normalized = cleaned.replace(',', '.');
  }
  
  return parseFloat(normalized);
};

// =====================================================
// FUNÇÕES DE FILTRO DE ENTRADA
// =====================================================

/**
 * Filtra texto para manter apenas números (0-9)
 * Útil para: CPF, RG, telefone, quantidades
 * @param {string} text - Texto a ser filtrado
 * @returns {string} - Texto contendo apenas dígitos
 */
export const filterOnlyNumbers = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[^0-9]/g, '');
};

/**
 * Filtra texto para manter apenas letras, espaços e acentos
 * Útil para: nome, nacionalidade, profissão, estado civil
 * @param {string} text - Texto a ser filtrado
 * @returns {string} - Texto contendo apenas letras, espaços e acentos
 */
export const filterOnlyLetters = (text) => {
  if (!text || typeof text !== 'string') return '';
  // Permite letras (a-z, A-Z), acentos (À-ÿ) e espaços
  return text.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
};

/**
 * Filtra texto para valores monetários (números, vírgula, ponto)
 * Útil para: aluguel, depósito, valores financeiros
 * @param {string} text - Texto a ser filtrado
 * @returns {string} - Texto contendo apenas números, vírgula e ponto
 */
export const filterMoney = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[^0-9,.-]/g, '');
};

/**
 * Filtra texto para endereços (alfanumérico + caracteres especiais comuns)
 * Útil para: endereços completos
 * @param {string} text - Texto a ser filtrado
 * @returns {string} - Texto contendo caracteres válidos para endereço
 */
export const filterAddress = (text) => {
  if (!text || typeof text !== 'string') return '';
  // Permite letras, números, espaços, acentos, vírgula, ponto, hífen, barra
  return text.replace(/[^a-zA-ZÀ-ÿ0-9\s,.\-\/°º]/g, '');
};

