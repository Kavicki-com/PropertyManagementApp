-- Instrumentação da primeira sessão (plano, "Depois do Dia 1", item 5).
-- Aplicada em 2026-09-17.
--
-- Não há analytics no app: hoje só dá para inferir comportamento pelo que sobra
-- no Postgres (contagem de imóveis, last_sign_in_at). Isso não responde as
-- perguntas que importam: onde a pessoa para na primeira sessão, quantas batem
-- na parede do Gratuito, quantas abrem a tela de assinatura depois de bater.
--
-- Tabela própria em vez de SDK de terceiro: o cliente Supabase já está no app,
-- não adiciona dependência nativa (que exigiria build novo, hoje bloqueado pela
-- migração do IAP) e o dado fica no banco que o dono já consulta.

create table if not exists public.app_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  event       text not null,
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.app_events is
  'Eventos de produto. Sem PII: props carrega contadores e flags, nunca nome, email, CPF ou endereço.';

create index if not exists app_events_event_created_idx
  on public.app_events (event, created_at desc);

create index if not exists app_events_user_created_idx
  on public.app_events (user_id, created_at desc);

alter table public.app_events enable row level security;

-- O app só escreve, e só em nome do próprio usuário. Ninguém lê pela API:
-- a leitura é feita com service_role, fora do app.
drop policy if exists "usuario insere os proprios eventos" on public.app_events;
create policy "usuario insere os proprios eventos"
  on public.app_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

revoke all on public.app_events from anon;
grant insert on public.app_events to authenticated;
grant all on public.app_events to service_role;


-- ---------------------------------------------------------------------------
-- Como ler (rodar com service_role)
-- ---------------------------------------------------------------------------
--
-- A métrica da aposta — quantos locadores voltaram para uma segunda sessão:
--
--   select count(*) from (
--     select user_id from app_events
--     where event = 'session_started'
--     group by user_id having count(*) >= 2
--   ) s;
--
-- Funil da primeira sessão, por usuário:
--
--   select user_id,
--     count(*) filter (where event = 'session_started')          as sessoes,
--     count(*) filter (where event = 'property_form_opened')     as abriu_form,
--     count(*) filter (where event = 'property_created')         as criou_imovel,
--     count(*) filter (where event = 'plan_limit_hit')           as bateu_parede,
--     count(*) filter (where event = 'subscription_screen_opened') as viu_planos
--   from app_events group by user_id order by sessoes desc;
--
-- Onde a parede é batida (o "+" da lista, o imóvel bloqueado, ou o formulário
-- já preenchido — este último é o pior momento possível):
--
--   select props->>'origem' as origem, count(*)
--   from app_events where event = 'plan_limit_hit' group by 1 order by 2 desc;
