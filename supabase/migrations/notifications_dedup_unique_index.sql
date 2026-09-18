-- Lote 1, tarefa 1.2 — aplicada em 2026-09-17.
--
-- Rede de segurança para a dedup: se a lógica da função voltar a falhar, o
-- banco recusa a linha duplicada em vez de aceitar em silêncio.
--
-- Dois detalhes que não são opcionais:
--
-- 1. O `coalesce` sobre data->>'contract_id'. Em índice único do Postgres,
--    NULLs nunca conflitam entre si — e contract_id nulo era exatamente o
--    caso do bug da 1.1. Sem o coalesce o índice não protegeria nada.
--
-- 2. `(timezone('utc', created_at))::date` em vez de `created_at::date`. O
--    cast direto de timestamptz para date depende do TimeZone da sessão e por
--    isso não é IMMUTABLE — o Postgres recusa o índice. Como o banco roda em
--    UTC, essa expressão dá o mesmo dia que o `DATE(n.created_at)` usado
--    dentro de check_rent_notifications_v2.

create unique index if not exists notifications_dedup_dia
  on notifications (
    user_id,
    type,
    (coalesce(data->>'contract_id', '')),
    ((timezone('utc', created_at))::date)
  );
