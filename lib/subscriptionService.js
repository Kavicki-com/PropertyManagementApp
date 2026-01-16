import { supabase } from './supabase';

/**
 * Serviço de assinatura para gerenciar limites de imóveis por plano
 */

// Limites de imóveis por plano
const PLAN_LIMITS = {
  free: 2,
  basic: 10,
  premium: 999999, // Sem limite prático
};

/**
 * Conta o número de imóveis ativos do usuário (não arquivados)
 * IMPORTANTE: Esta função conta TODOS os imóveis ativos, incluindo os que podem estar
 * bloqueados temporariamente por limite de plano. Quando o usuário faz upgrade de plano,
 * todos os imóveis existentes são automaticamente contados no novo limite.
 */
export async function getActivePropertiesCount(userId) {
  const { count, error } = await supabase
    .from('properties')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('archived_at', null);

  if (error) {
    console.error('Erro ao contar imóveis ativos:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Determina o plano necessário baseado na quantidade de imóveis
 */
export function getRequiredPlan(propertyCount) {
  if (propertyCount <= PLAN_LIMITS.free) {
    return 'free';
  } else if (propertyCount <= PLAN_LIMITS.basic) {
    return 'basic';
  } else {
    return 'premium';
  }
}

/**
 * Retorna os limites de um plano específico
 */
export function getSubscriptionLimits(plan) {
  return {
    maxProperties: PLAN_LIMITS[plan] || PLAN_LIMITS.free,
    plan: plan || 'free',
  };
}

/**
 * Busca dados da assinatura do usuário
 */
export async function getUserSubscription(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_plan, subscription_status, subscription_started_at, subscription_expires_at, subscription_iap_transaction_id, subscription_trial_ends_at, subscription_grace_period_ends_at')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Erro ao buscar assinatura do usuário:', error);
    return null;
  }

  return data;
}

/**
 * Verifica se a assinatura está ativa e válida
 */
export async function checkSubscriptionStatus(userId) {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    return { active: false, reason: 'Assinatura não encontrada' };
  }

  const plan = subscription.subscription_plan || 'free';

  // Se o plano for 'basic' ou 'premium', considera ativo mesmo sem todas as condições
  // Isso permite que alterações diretas no banco funcionem
  if (plan === 'basic' || plan === 'premium') {
    const now = new Date();
    const expiresAt = subscription.subscription_expires_at
      ? new Date(subscription.subscription_expires_at)
      : null;

    // Se tem data de expiração e já expirou, verifica
    if (expiresAt && now >= expiresAt) {
      return { active: false, reason: 'Assinatura expirada' };
    }

    // Status 'cancelled' com data de expiração futura: usuário ainda tem acesso
    // Isso acontece quando o usuário faz downgrade mas o período pago ainda não acabou
    if (subscription.subscription_status === 'cancelled') {
      if (expiresAt && now < expiresAt) {
        return { active: true, reason: `Plano ${plan} ativo até expiração (cancelado)`, cancelled: true };
      }
      return { active: false, reason: 'Assinatura cancelada e expirada' };
    }

    // Se o status é 'expired', considera inativo
    if (subscription.subscription_status === 'expired') {
      return { active: false, reason: 'Status: expired' };
    }

    // Se o plano é basic ou premium, considera ativo (mesmo sem status/expiração configurados)
    // Isso permite que alterações diretas no banco funcionem
    return { active: true, reason: `Plano ${plan} ativo` };
  }

  // Para plano free, verifica condições normais
  const now = new Date();
  const expiresAt = subscription.subscription_expires_at
    ? new Date(subscription.subscription_expires_at)
    : null;

  // Verifica se está em período de teste
  const trialEndsAt = subscription.subscription_trial_ends_at
    ? new Date(subscription.subscription_trial_ends_at)
    : null;

  if (trialEndsAt && now < trialEndsAt) {
    return { active: true, reason: 'Período de teste ativo', trial: true };
  }

  // Verifica período de graça
  const gracePeriodEndsAt = subscription.subscription_grace_period_ends_at
    ? new Date(subscription.subscription_grace_period_ends_at)
    : null;

  if (gracePeriodEndsAt && now < gracePeriodEndsAt) {
    return { active: true, reason: 'Período de graça ativo', gracePeriod: true };
  }

  // Verifica se assinatura está ativa e não expirou
  if (subscription.subscription_status === 'active' && expiresAt && now < expiresAt) {
    return { active: true, reason: 'Assinatura ativa' };
  }

  // Se expirou, retorna inativo
  if (expiresAt && now >= expiresAt) {
    return { active: false, reason: 'Assinatura expirada' };
  }

  // Se status não é ativo
  if (subscription.subscription_status !== 'active') {
    return { active: false, reason: `Status: ${subscription.subscription_status}` };
  }

  // Se não tem data de expiração e não está em teste, considera inativo
  return { active: false, reason: 'Assinatura sem data de expiração válida' };
}

/**
 * Valida se o usuário pode adicionar mais imóveis
 */
export async function canAddProperty(userId) {
  const propertyCount = await getActivePropertiesCount(userId);
  const subscription = await getUserSubscription(userId);
  const status = await checkSubscriptionStatus(userId);

  if (!subscription) {
    // Se não tem assinatura, permite até o limite do plano Free
    return propertyCount < PLAN_LIMITS.free;
  }

  const plan = subscription.subscription_plan || 'free';
  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  // Se está em período de teste ou graça, permite adicionar
  if (status.trial || status.gracePeriod) {
    return true;
  }

  // Se assinatura está ativa, verifica limite do plano
  if (status.active) {
    return propertyCount < limit;
  }

  // Se assinatura expirou, permite apenas até o limite do plano Free
  return propertyCount < PLAN_LIMITS.free;
}

/**
 * Verifica se uma propriedade específica está bloqueada
 */
export async function isPropertyBlocked(userId, propertyId) {
  if (!propertyId) {
    // Se não tem propertyId, verifica se há propriedades bloqueadas em geral
    const blocked = await getBlockedProperties(userId);
    return blocked.length > 0;
  }

  // Verifica se a propriedade específica está na lista de bloqueadas
  const blockedProperties = await getBlockedProperties(userId);
  return blockedProperties.includes(propertyId);
}

/**
 * Retorna lista de IDs de propriedades bloqueadas (excedentes)
 */
export async function getBlockedProperties(userId) {
  const propertyCount = await getActivePropertiesCount(userId);
  const subscription = await getUserSubscription(userId);
  const status = await checkSubscriptionStatus(userId);

  if (!subscription) {
    // Sem assinatura: bloqueia todas além do limite Free
    if (propertyCount <= PLAN_LIMITS.free) {
      return [];
    }

    const { data } = await supabase
      .from('properties')
      .select('id')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .range(PLAN_LIMITS.free, propertyCount - 1);

    return (data || []).map(p => p.id);
  }

  const plan = subscription.subscription_plan || 'free';
  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  // Se está em período de teste ou graça, não há bloqueios
  if (status.trial || status.gracePeriod) {
    return [];
  }

  // Se assinatura está ativa, bloqueia apenas os que excedem o limite do plano
  // IMPORTANTE: Se propertyCount <= limit, retorna array vazio (nenhum bloqueado)
  // Isso significa que TODOS os imóveis existentes ficam disponíveis quando o plano está ativo
  if (status.active) {
    // Se a contagem está dentro do limite do plano, nenhum imóvel está bloqueado
    // Exemplo: plano básico (10) com 8 imóveis = nenhum bloqueado
    if (propertyCount <= limit) {
      return [];
    }

    // Apenas bloqueia os imóveis que excedem o limite (os mais antigos)
    const { data } = await supabase
      .from('properties')
      .select('id')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .range(limit, propertyCount - 1);

    return (data || []).map(p => p.id);
  }

  // Se assinatura expirou, bloqueia além do limite Free
  if (propertyCount <= PLAN_LIMITS.free) {
    return [];
  }

  const { data } = await supabase
    .from('properties')
    .select('id')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .range(PLAN_LIMITS.free, propertyCount - 1);

  return (data || []).map(p => p.id);
}

/**
 * Valida se o usuário pode acessar os detalhes de uma propriedade específica
 */
export async function canViewPropertyDetails(userId, propertyId) {
  const blockedProperties = await getBlockedProperties(userId);
  return !blockedProperties.includes(propertyId);
}

/**
 * Valida se o usuário pode adicionar lançamentos financeiros
 * Plano gratuito não permite lançamentos financeiros
 */
export async function canAddFinancialTransaction(userId) {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    // Sem assinatura, não permite (plano free não permite)
    return false;
  }

  const plan = subscription.subscription_plan || 'free';

  // Plano gratuito não permite lançamentos financeiros
  if (plan === 'free') {
    return false;
  }

  // Planos basic e premium permitem
  return true;
}

/**
 * Conta o número total de documentos de inquilinos do usuário
 */
export async function getTotalDocumentsCount(userId) {
  const { count, error } = await supabase
    .from('tenant_documents')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error('Erro ao contar documentos:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Valida se o usuário pode adicionar mais documentos
 * Plano gratuito: máximo 1 documento
 * Planos básico e premium: ilimitado
 */
export async function canAddDocument(userId) {
  const subscription = await getUserSubscription(userId);
  const plan = subscription?.subscription_plan || 'free';

  // Planos básico e premium permitem documentos ilimitados
  if (plan === 'basic' || plan === 'premium') {
    return true;
  }

  // Plano gratuito: máximo 1 documento
  const documentCount = await getTotalDocumentsCount(userId);
  return documentCount < 1;
}

/**
 * Conta o número de inquilinos ativos do usuário
 * IMPORTANTE: Esta função conta TODOS os inquilinos, incluindo os que podem estar
 * bloqueados temporariamente por limite de plano. Quando o usuário faz upgrade de plano,
 * todos os inquilinos existentes são automaticamente contados no novo limite.
 */
export async function getActiveTenantsCount(userId) {
  const { count, error } = await supabase
    .from('tenants')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error('Erro ao contar inquilinos ativos:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Valida se o usuário pode adicionar mais inquilinos
 */
export async function canAddTenant(userId) {
  const tenantCount = await getActiveTenantsCount(userId);
  const subscription = await getUserSubscription(userId);
  const status = await checkSubscriptionStatus(userId);

  if (!subscription) {
    // Se não tem assinatura, permite até o limite do plano Free
    return tenantCount < PLAN_LIMITS.free;
  }

  const plan = subscription.subscription_plan || 'free';
  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  // Se está em período de teste ou graça, permite adicionar
  if (status.trial || status.gracePeriod) {
    return true;
  }

  // Se assinatura está ativa, verifica limite do plano
  if (status.active) {
    return tenantCount < limit;
  }

  // Se assinatura expirou, permite apenas até o limite do plano Free
  return tenantCount < PLAN_LIMITS.free;
}

/**
 * Retorna lista de IDs de inquilinos bloqueados (excedentes)
 * IMPORTANTE: Esta função recalcula automaticamente baseado no plano atual.
 * Quando o usuário faz upgrade, os inquilinos que estavam bloqueados e agora
 * estão dentro do novo limite são automaticamente desbloqueados.
 */
export async function getBlockedTenants(userId) {
  // Conta TODOS os inquilinos (incluindo os que podem estar bloqueados)
  const tenantCount = await getActiveTenantsCount(userId);
  const subscription = await getUserSubscription(userId);
  const status = await checkSubscriptionStatus(userId);

  if (!subscription) {
    // Sem assinatura: bloqueia todas além do limite Free
    if (tenantCount <= PLAN_LIMITS.free) {
      return [];
    }

    const { data } = await supabase
      .from('tenants')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(PLAN_LIMITS.free, tenantCount - 1);

    return (data || []).map(t => t.id);
  }

  const plan = subscription.subscription_plan || 'free';
  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  // Se está em período de teste ou graça, não há bloqueios
  if (status.trial || status.gracePeriod) {
    return [];
  }

  // Se assinatura está ativa, bloqueia apenas os que excedem o limite do plano
  // IMPORTANTE: Se tenantCount <= limit, retorna array vazio (nenhum bloqueado)
  // Isso significa que TODOS os inquilinos existentes ficam disponíveis quando o plano está ativo
  if (status.active) {
    // Se a contagem está dentro do limite do plano, nenhum inquilino está bloqueado
    // Exemplo: plano básico (10) com 8 inquilinos = nenhum bloqueado
    if (tenantCount <= limit) {
      return [];
    }

    // Apenas bloqueia os inquilinos que excedem o limite (os mais antigos)
    const { data } = await supabase
      .from('tenants')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(limit, tenantCount - 1);

    return (data || []).map(t => t.id);
  }

  // Se assinatura expirou, bloqueia além do limite Free
  if (tenantCount <= PLAN_LIMITS.free) {
    return [];
  }

  const { data } = await supabase
    .from('tenants')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(PLAN_LIMITS.free, tenantCount - 1);

  return (data || []).map(t => t.id);
}

/**
 * Valida se o usuário pode acessar os detalhes de um inquilino específico
 */
export async function canViewTenantDetails(userId, tenantId) {
  const blockedTenants = await getBlockedTenants(userId);
  return !blockedTenants.includes(tenantId);
}

