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

export default { formatCurrency };
