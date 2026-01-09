import { supabase } from './supabase';

// Serviço simples de propriedades para concentrar regras de histórico / arquivamento

export async function fetchAllProperties() {
  // Query otimizada - buscar apenas campos necessários
  const { data, error } = await supabase
    .from('properties')
    .select('id, address, street, number, neighborhood, city, state, rent, type, image_urls, tenants(id)')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  return { data, error };
}

// Move a propriedade atual para tabela de histórico (archived_properties)
// e mantém os registros financeiros e vínculos como estão, apenas marcando o imóvel como arquivado.
export async function archivePropertyWithHistory(property) {
  if (!property?.id) {
    throw new Error('Propriedade inválida para arquivamento');
  }

  // 1) Criar registro em archived_properties com um snapshot dos dados principais
  const { error: archiveError } = await supabase.from('archived_properties').insert({
    original_property_id: property.id,
    snapshot: property,
    archived_at: new Date().toISOString(),
  });

  if (archiveError) {
    return { error: archiveError };
  }

  // 2) Marcar a propriedade original como arquivada (sem deletar)
  const { error: updateError } = await supabase
    .from('properties')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', property.id);

  return { error: updateError };
}


