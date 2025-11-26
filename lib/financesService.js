import { supabase } from './supabase';

// --------- Tipos utilitários (JS puro, apenas por documentação) ---------
// transaction: {
//   id, description, amount, type, date,
//   property_id, tenant_id,
//   properties?: { address }
//   // Atenção: não há relação declarada entre finances e tenants no Supabase,
//   // então não fazemos join automático aqui. Se precisar do inquilino,
//   // use tenant_id para buscar em outra query.
// }

// Busca todos os lançamentos financeiros do usuário logado (opcionalmente com filtros simples)
// Filtros suportados:
// - startDate, endDate: intervalo de datas (yyyy-mm-dd)
// - type: 'income' | 'expense' | 'all'
// - propertyId: filtra por imóvel específico
// - tenantId: filtra por inquilino específico
export async function fetchAllFinances({ startDate, endDate, type, propertyId, tenantId } = {}) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { data: [], error: userError || new Error('Usuário não autenticado') };
  }

  let query = supabase
    .from('finances')
    .select('*, properties (address), tenants (full_name)')
    .eq('user_id', user.id)
    .order('date', { ascending: false });

  if (startDate) {
    query = query.gte('date', startDate);
  }
  if (endDate) {
    query = query.lte('date', endDate);
  }
  if (type && type !== 'all') {
    query = query.eq('type', type);
  }
  if (propertyId) {
    query = query.eq('property_id', propertyId);
  }
  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query;
  return { data: data || [], error };
}

// Busca lançamentos por propriedade
export async function fetchFinancesByProperty(propertyId, { limit } = {}) {
  if (!propertyId) {
    return { data: [], error: new Error('propertyId é obrigatório') };
  }

  let query = supabase
    .from('finances')
    .select('id, description, amount, type, date')
    .eq('property_id', propertyId)
    .order('date', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  return { data: data || [], error };
}

// Cálculo da visão geral (entradas, despesas, lucro)
export function calculateOverview(transactions) {
  const totalIncome = (transactions || [])
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalExpenses = (transactions || [])
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const netProfit = totalIncome - totalExpenses;

  return { totalIncome, totalExpenses, netProfit };
}

// Criação de um lançamento financeiro básico
export async function createTransaction({
  propertyId,
  tenantId,
  description,
  amount,
  type = 'income',
  date = new Date().toISOString(),
}) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: userError || new Error('Usuário não autenticado') };
  }

  const { error } = await supabase.from('finances').insert({
    user_id: user.id,
    property_id: propertyId,
    tenant_id: tenantId ?? null,
    description,
    amount: parseFloat(amount),
    type,
    date,
  });

  return { error };
}

// Resumo de cobrança do inquilino (equivalente ao billingSummary atual)
export async function fetchTenantBillingSummary(tenant) {
  if (!tenant?.property_id || !tenant.start_date || !tenant.due_date) {
    return {
      summary: { expected: 0, paid: 0, overdue: 0 },
      schedule: [],
      error: null,
    };
  }

  const today = new Date();
  const start = new Date(tenant.start_date);
  const contractTotal = tenant.lease_term || 0;

  if (contractTotal === 0) {
    return {
      summary: { expected: 0, paid: 0, overdue: 0 },
      schedule: [],
      error: null,
    };
  }

  // Meses decorridos desde o início da locação
  const monthsDiff =
    (today.getFullYear() - start.getFullYear()) * 12 +
    (today.getMonth() - start.getMonth());

  // Faturas que já deveriam ter acontecido até hoje (limitadas ao total do contrato)
  const dueSoFar = Math.min(
    contractTotal,
    Math.max(0, monthsDiff + 1),
  );

  let query = supabase
    .from('finances')
    .select('id, type, date, property_id, tenant_id')
    .eq('property_id', tenant.property_id);

  // Se soubermos o inquilino/contrato, filtramos também por tenant_id
  if (tenant.tenant_id) {
    query = query.eq('tenant_id', tenant.tenant_id);
  }

  const { data: financesData, error: financesError } = await query;

  if (financesError) {
    return {
      summary: {
        expected: contractTotal,
        paid: 0,
        overdue: dueSoFar,
      },
      schedule: [],
      error: financesError,
    };
  }

  // Considera todas as receitas ligadas ao contrato como faturas pagas.
  const paidInvoices = (financesData || []).filter((f) => f.type === 'income').length;

  const overdue = Math.max(0, dueSoFar - paidInvoices);

  // Gera um cronograma simples de meses do contrato com status aproximado
  const schedule = Array.from({ length: contractTotal }).map((_, index) => {
    const monthIndex = index + 1;
    let status = 'future';
    if (monthIndex <= paidInvoices) {
      status = 'paid';
    } else if (monthIndex <= dueSoFar) {
      status = 'overdue';
    }
    return {
      monthIndex,
      status,
    };
  });

  return {
    summary: {
      expected: contractTotal,
      paid: paidInvoices,
      overdue,
    },
    schedule,
    error: null,
  };
}



