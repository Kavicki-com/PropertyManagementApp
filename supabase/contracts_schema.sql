-- Tabela de contratos de locação
-- Execute este script no Supabase (SQL editor) para criar a estrutura.

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),

  -- Relações principais
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,

  -- Datas e período
  start_date timestamptz not null,
  end_date timestamptz,
  lease_term integer,        -- duração prevista em meses (opcional, pode ser derivada de start/end)

  -- Condições financeiras
  due_day integer,           -- dia de vencimento (1-31)
  rent_amount integer,       -- valor do aluguel em centavos (mantém padrão do app)
  deposit integer,           -- caução em centavos

  -- Status do contrato
  status text not null default 'active' check (status in ('active', 'ended')),

  -- Metadados
  user_id uuid references auth.users (id),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Índices úteis para buscas comuns
create index if not exists contracts_tenant_id_idx
  on public.contracts (tenant_id);

create index if not exists contracts_property_id_idx
  on public.contracts (property_id);

create index if not exists contracts_status_idx
  on public.contracts (status);

-- Garante (via convenção, não constraint forte) no máximo 1 contrato ativo por imóvel
-- e por inquilino. Se quiser reforçar via SQL, você pode usar partial unique indexes:

-- create unique index if not exists contracts_unique_active_per_property
--   on public.contracts (property_id)
--   where status = 'active';

-- create unique index if not exists contracts_unique_active_per_tenant
--   on public.contracts (tenant_id)
--   where status = 'active';


