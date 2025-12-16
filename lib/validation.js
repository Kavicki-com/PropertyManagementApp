// lib/validation.js
// Utilitário de validação reutilizável para formulários

/**
 * Valida CPF usando o algoritmo de dígitos verificadores (Módulo 11)
 */
export const isValidCPF = (cpf) => {
  if (typeof cpf !== 'string') return false;
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11) return false;
  if (!!cpf.match(/(\d)\1{10}/)) return false;
  
  let soma = 0;
  let resto;
  for (let i = 1; i <= 9; i++) {
    soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  
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
 * Valida email com regras robustas
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,10}$/;
  if (!emailRegex.test(trimmed)) return false;
  if (trimmed.length > 254) return false;
  if (trimmed.split('@')[0].length > 64) return false;
  if (trimmed.includes('..')) return false;
  const localPart = trimmed.split('@')[0];
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  return true;
};

/**
 * Valida senha com requisitos de segurança
 */
export const validatePassword = (password) => {
  const errors = [];
  if (!password || typeof password !== 'string') {
    return { isValid: false, errors: ['Senha é obrigatória'] };
  }
  if (password.length < 8) {
    errors.push('A senha deve ter no mínimo 8 caracteres');
  }
  if (!/[a-zA-Z0-9]/.test(password)) {
    errors.push('A senha deve conter letras ou números');
  }
  const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;
  if (!specialCharRegex.test(password)) {
    errors.push('A senha deve conter pelo menos 1 caractere especial (!@#$%^&*...)');
  }
  return { isValid: errors.length === 0, errors };
};

export const isValidPassword = (password) => validatePassword(password).isValid;

/**
 * Retorna a força da senha
 */
export const getPasswordStrength = (password) => {
  if (!password || typeof password !== 'string') {
    return { strength: 'weak', score: 0, label: 'Muito fraca' };
  }
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) score += 2;
  if (/^[a-zA-Z]+$/.test(password)) score -= 1;
  if (/^[0-9]+$/.test(password)) score -= 2;
  if (/(.)\1{2,}/.test(password)) score -= 1;
  
  if (score <= 2) return { strength: 'weak', score, label: 'Fraca' };
  if (score <= 5) return { strength: 'medium', score, label: 'Média' };
  return { strength: 'strong', score, label: 'Forte' };
};

/**
 * Valida telefone brasileiro (10 ou 11 dígitos)
 */
export const isValidPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const numbers = phone.replace(/\D/g, '');
  return numbers.length >= 10 && numbers.length <= 11;
};

/**
 * Valida número inteiro positivo com limites
 */
export const isValidInteger = (value, options = {}) => {
  const { min = 0, max = Infinity } = options;
  if (value === null || value === undefined || value === '') return false;
  const num = typeof value === 'string' ? parseInt(value.replace(/[^0-9]/g, ''), 10) : parseInt(value, 10);
  if (isNaN(num)) return false;
  if (num < min || num > max) return false;
  return true;
};

/**
 * Valida valor monetário
 */
export const isValidMoney = (value, options = {}) => {
  const { min = 0, max = Infinity } = options;
  if (value === null || value === undefined || value === '') return false;
  const cleaned = typeof value === 'string' 
    ? value.replace(/[^\d,.-]/g, '').replace(',', '.') 
    : String(value);
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < min || num > max) return false;
  return true;
};

/**
 * Converte string monetária para número
 */
export const parseMoney = (value) => {
  if (!value || typeof value !== 'string') return NaN;
  const cleaned = value.replace(/[^\d,.-]/g, '');
  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  }
  return parseFloat(normalized);
};

// =====================================================
// FUNÇÕES DE FILTRO DE ENTRADA
// =====================================================

/**
 * Filtra para manter apenas números (0-9)
 */
export const filterOnlyNumbers = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[^0-9]/g, '');
};

/**
 * Filtra para manter apenas letras, espaços e acentos
 */
export const filterOnlyLetters = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
};

/**
 * Filtra para valores monetários
 */
export const filterMoney = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[^0-9,.-]/g, '');
};

/**
 * Filtra para endereços (alfanumérico + especiais)
 */
export const filterAddress = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[^a-zA-ZÀ-ÿ0-9\s,.\-\/°º]/g, '');
};

// =====================================================
// FUNÇÕES DE CEP E ENDEREÇO
// =====================================================

/**
 * Filtra e formata CEP (00000-000)
 */
export const filterCep = (text) => {
  if (!text || typeof text !== 'string') return '';
  const numbers = text.replace(/\D/g, '').slice(0, 8);
  if (numbers.length > 5) {
    return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
  }
  return numbers;
};

/**
 * Valida se o CEP tem 8 dígitos
 */
export const isValidCep = (cep) => {
  if (!cep || typeof cep !== 'string') return false;
  return cep.replace(/\D/g, '').length === 8;
};

/**
 * Filtra número de endereço (apenas números)
 */
export const filterAddressNumber = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[^0-9]/g, '');
};

/**
 * Filtra UF (2 letras maiúsculas)
 */
export const filterUF = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2);
};

/**
 * Lista de UFs válidas do Brasil
 */
export const VALID_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

/**
 * Valida se é uma UF brasileira válida
 */
export const isValidUF = (uf) => {
  if (!uf || typeof uf !== 'string') return false;
  return VALID_UFS.includes(uf.toUpperCase());
};

