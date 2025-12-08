import { supabase } from './supabase';

// Serviço centralizado de contratos de locação

export async function fetchContractsByTenant(tenantId) {
  if (!tenantId) {
    return { data: [], error: new Error('tenantId é obrigatório') };
  }

  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('start_date', { ascending: false });

  return { data: data || [], error };
}

export async function fetchActiveContractByTenant(tenantId) {
  if (!tenantId) {
    return { data: null, error: new Error('tenantId é obrigatório') };
  }

  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .maybeSingle();

  return { data, error };
}

export async function fetchActiveContractByProperty(propertyId) {
  if (!propertyId) {
    return { data: null, error: new Error('propertyId é obrigatório') };
  }

  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('property_id', propertyId)
    .eq('status', 'active')
    .maybeSingle();

  return { data, error };
}

// Busca todos os contratos ativos para uma lista de inquilinos e retorna um map tenantId -> contract
export async function fetchActiveContractsByTenants(tenantIds) {
  const ids = (tenantIds || []).filter(Boolean);
  if (ids.length === 0) {
    return { data: {}, error: null };
  }

  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .in('tenant_id', ids)
    .eq('status', 'active');

  if (error) {
    return { data: {}, error };
  }

  const map = {};
  (data || []).forEach((c) => {
    // Assumimos no máximo 1 contrato ativo por inquilino
    if (!map[c.tenant_id]) {
      map[c.tenant_id] = c;
    }
  });

  return { data: map, error: null };
}

export async function createContract({
  tenantId,
  propertyId,
  startDate,
  endDate,
  dueDay,
  rentAmount,
  deposit,
  leaseTerm,
}) {
  if (!tenantId || !propertyId || !startDate) {
    return { data: null, error: new Error('tenantId, propertyId e startDate são obrigatórios') };
  }

  // Obtém usuário atual para salvar user_id no contrato
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { data: null, error: userError || new Error('Usuário não autenticado') };
  }

  // Encerra contratos ativos anteriores deste inquilino ou deste imóvel
  const nowIso = new Date().toISOString();

  await supabase
    .from('contracts')
    .update({ status: 'ended', ended_at: nowIso })
    .or(`tenant_id.eq.${tenantId},property_id.eq.${propertyId}`)
    .eq('status', 'active');

  const { data, error } = await supabase
    .from('contracts')
    .insert({
      tenant_id: tenantId,
      property_id: propertyId,
      start_date: startDate,
      end_date: endDate || null,
      lease_term: leaseTerm ?? null,
      due_day: dueDay ?? null,
      rent_amount: rentAmount != null ? parseInt(rentAmount, 10) : null,
      deposit: deposit != null ? parseInt(deposit, 10) : null,
      status: 'active',
      user_id: user.id,
    })
    .select('*')
    .single();

  if (error) {
    return { data: null, error };
  }

  // Garante que o inquilino esteja vinculado ao imóvel do contrato
  await supabase
    .from('tenants')
    .update({ property_id: propertyId })
    .eq('id', tenantId);

  return { data, error: null };
}

export async function endContract(contractId) {
  if (!contractId) {
    return { error: new Error('contractId é obrigatório') };
  }

  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from('contracts')
    .update({ status: 'ended', ended_at: nowIso })
    .eq('id', contractId);

  return { error };
}







