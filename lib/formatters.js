/**
 * Formatação de valores em pt-BR, em um lugar só.
 *
 * Antes existiam sete cópias de formatCurrency espalhadas pelas telas, em três
 * variantes diferentes — e nenhuma delas produzia o formato brasileiro:
 *   `R$${Number(v).toFixed(2)}`                      -> R$1100.00
 *   `R$ ${Number(v).toFixed(2).replace('.', ',')}`   -> R$ 1100,00
 * Faltava separador de milhar nas duas, e a primeira ainda usava ponto decimal.
 *
 * Intl.NumberFormat é o caminho certo, mas nem toda build do Hermes traz ICU
 * completo, então há um fallback manual que produz exatamente o mesmo formato.
 */

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  // Colunas numeric chegam do supabase-js como string.
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

let currencyFormatter = null;
try {
  currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
} catch (error) {
  currencyFormatter = null;
}

const formatCurrencyManual = (numero) => {
  const negativo = numero < 0;
  const [inteiro, decimal] = Math.abs(numero).toFixed(2).split('.');
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-' : ''}R$ ${comMilhar},${decimal}`;
};

/**
 * @param {number|string|null|undefined} value
 * @returns {string} ex.: "R$ 1.100,00"
 */
export const formatCurrency = (value) => {
  const numero = toNumber(value);

  if (!currencyFormatter) {
    return formatCurrencyManual(numero);
  }

  try {
    // Intl separa o símbolo com espaço não-quebrável; normalizamos para espaço
    // comum para que o texto seja igual ao do fallback.
    return currencyFormatter.format(numero).replace(/ /g, ' ');
  } catch (error) {
    return formatCurrencyManual(numero);
  }
};

/**
 * Máscara de telefone brasileiro, tolerante a entrada parcial.
 *
 * Aceita fixo (10 dígitos) e celular (11). Devolve o texto como está quando
 * passa de 11 dígitos, para não brigar com quem cola um número com DDI.
 *
 * Existe aqui porque três telas (EditProfile, AddTenant, EditTenant) têm uma
 * cópia local idêntica desta função. O cadastro seria a quarta — as outras
 * migram quando alguém encostar nelas.
 *
 * @param {string} text
 * @returns {string} ex.: "(11) 98765-4321"
 */
export const formatPhone = (text) => {
  const numbers = String(text ?? '').replace(/\D/g, '');

  if (numbers.length <= 2) return numbers;

  if (numbers.length <= 10) {
    if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }

  if (numbers.length <= 11) {
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }

  return text;
};

export default { formatCurrency, formatPhone };
