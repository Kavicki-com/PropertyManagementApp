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

  // Query otimizada - buscar apenas campos necessários
  let query = supabase
    .from('finances')
    .select('id, description, amount, type, date, property_id, tenant_id, properties (address), tenants (full_name)')
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

  // Query já otimizada - buscar apenas campos necessários
  let query = supabase
    .from('finances')
    .select('id, description, amount, type, date, property_id, tenant_id')
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
  today.setHours(0, 0, 0, 0); // Normalizar para início do dia
  
  const start = new Date(tenant.start_date);
  start.setHours(0, 0, 0, 0);
  
  const contractTotal = tenant.lease_term || 0;
  const dueDay = tenant.due_date; // Dia do mês de vencimento (1-31)

  if (contractTotal === 0 || !dueDay) {
    return {
      summary: { expected: 0, paid: 0, overdue: 0 },
      schedule: [],
      error: null,
    };
  }

  // Buscar pagamentos registrados
  let query = supabase
    .from('finances')
    .select('id, type, date, property_id, tenant_id')
    .eq('property_id', tenant.property_id)
    .eq('type', 'income');

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
        overdue: 0,
      },
      schedule: [],
      error: financesError,
    };
  }

  // Função auxiliar para calcular a data de vencimento de uma mensalidade
  const calculateDueDate = (monthIndex) => {
    // monthIndex: 1, 2, 3, ... (primeira, segunda, terceira mensalidade, etc.)
    const dueDate = new Date(start);
    dueDate.setMonth(start.getMonth() + (monthIndex - 1));
    
    // Ajustar para o dia de vencimento correto
    // Se o dia não existir no mês (ex: 31 em fevereiro), usar o último dia do mês
    const lastDayOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
    const dayToSet = Math.min(dueDay, lastDayOfMonth);
    dueDate.setDate(dayToSet);
    
    return dueDate;
  };

  // Rastrear quais pagamentos já foram associados a uma mensalidade
  const usedPayments = new Set();

  // Função auxiliar para verificar se há pagamento para uma mensalidade
  const hasPaymentForMonth = (dueDate) => {
    if (!financesData || financesData.length === 0) return false;
    
    // Janela de pagamento: de 10 dias antes até 5 dias depois do vencimento
    const paymentWindowStart = new Date(dueDate);
    paymentWindowStart.setDate(paymentWindowStart.getDate() - 10);
    
    const paymentWindowEnd = new Date(dueDate);
    paymentWindowEnd.setDate(paymentWindowEnd.getDate() + 5);
    
    // Encontrar o primeiro pagamento não usado dentro da janela
    const matchingPayment = financesData.find((payment) => {
      if (usedPayments.has(payment.id)) return false;
      
      const paymentDate = new Date(payment.date);
      paymentDate.setHours(0, 0, 0, 0);
      
      // Pagamento deve estar dentro da janela de pagamento
      return paymentDate >= paymentWindowStart && paymentDate <= paymentWindowEnd;
    });
    
    if (matchingPayment) {
      usedPayments.add(matchingPayment.id);
      return true;
    }
    
    return false;
  };

  // Função auxiliar para calcular dias até o vencimento
  const daysUntilDue = (dueDate) => {
    const diffTime = dueDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Processar cada mensalidade do contrato
  let paidCount = 0;
  let overdueCount = 0;
  const schedule = [];

  for (let monthIndex = 1; monthIndex <= contractTotal; monthIndex++) {
    const dueDate = calculateDueDate(monthIndex);
    const hasPayment = hasPaymentForMonth(dueDate);
    const daysUntil = daysUntilDue(dueDate);

    let status;
    if (hasPayment) {
      status = 'paid';
      paidCount++;
    } else if (daysUntil < 0) {
      // Já venceu e não foi pago
      status = 'overdue';
      overdueCount++;
    } else if (daysUntil <= 5) {
      // Entre 0 e 5 dias antes do vencimento (à vencer)
      status = 'due_soon';
    } else {
      // Mais de 5 dias antes do vencimento
      status = 'future';
    }

    schedule.push({
      monthIndex,
      status,
      dueDate: dueDate.toISOString().split('T')[0], // Data no formato YYYY-MM-DD
    });
  }

  return {
    summary: {
      expected: contractTotal,
      paid: paidCount,
      overdue: overdueCount,
    },
    schedule,
    error: null,
  };
}



