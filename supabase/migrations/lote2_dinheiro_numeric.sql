-- Lote 2 — Dinheiro deixa de ser integer
--
-- As quatro colunas de dinheiro são `integer`, mas o app manda decimal:
-- AddContractScreen, AddPropertyScreen e AddTransactionScreen guardam a
-- máscara em centavos e dividem por 100 antes de salvar. O Postgres
-- arredonda na escrita, então R$ 1.100,50 vira 1101 e os centavos somem
-- em toda a base. Vira numeric(12,2) **em reais**, não centavos inteiros:
-- os valores atuais já estão em reais, o ALTER preserva tudo e nenhuma
-- borda do app precisa de conversão.
--
-- Levantado em 2026-09-21: nenhuma view depende dessas colunas, não há
-- check constraint sobre elas e a tabela tenants não tem trigger — o
-- ALTER é direto.
--
-- Rodar inteiro, de uma vez. É uma transação só: ou tudo, ou nada.

begin;

-- ---------------------------------------------------------------------
-- 2.1 Backup dos valores antes de qualquer ALTER
-- ---------------------------------------------------------------------
-- O schema `backup` não é exposto pela API. Guarda só id + valor, que é
-- o que permite reverter dado; a estrutura volta por ALTER inverso.

create table backup.lote2_20260921_finances_amount as
  select id, amount from public.finances;

create table backup.lote2_20260921_properties_rent as
  select id, rent from public.properties;

create table backup.lote2_20260921_contracts_valores as
  select id, rent_amount, deposit from public.contracts;

create table backup.lote2_20260921_tenants_cpf as
  select id, cpf from public.tenants;

-- ---------------------------------------------------------------------
-- 2.2 As quatro colunas viram numeric(12,2)
-- ---------------------------------------------------------------------

alter table public.finances   alter column amount      type numeric(12,2);
alter table public.properties alter column rent        type numeric(12,2);
alter table public.contracts  alter column rent_amount type numeric(12,2);
alter table public.contracts  alter column deposit     type numeric(12,2);

-- ---------------------------------------------------------------------
-- 2.3 properties.rent = 9 volta para 900
-- ---------------------------------------------------------------------
-- Imóvel ativo (Av. Getúlio Vargas, 2597 - AP 303, Cruz das Almas - BA).
-- Três dos quatro contratos dele, incluindo o **ativo**, têm
-- rent_amount = 900. O 9 é resultado do bug de EditPropertyScreen.js:101,
-- corrigido no mesmo lote: ao abrir a edição, o valor salvo era relido
-- como se fosse centavos, então 900 virava R$ 9,00 e salvava 9.
-- Sem a correção do app, este update volta a se desfazer sozinho.

update public.properties
   set rent = 900
 where id = '0a88b691-f6f4-45e6-9a6a-3eb9ede28392'
   and rent = 9;

-- ---------------------------------------------------------------------
-- 2.4 (parcial) o contrato encerrado que sofreu o mesmo acidente
-- ---------------------------------------------------------------------
-- Contrato encerrado do mesmo imóvel, com rent_amount = 9 e
-- deposit = 900 na mesma linha — o depósito é a prova de qual era o
-- aluguel. Os outros três contratos `ended` com valor suspeito
-- (32, 40 e 40, de 19/12/2025) ficam como estão: não há no registro
-- nada que diga qual seria o valor certo, e inventar número em
-- contrato encerrado é pior que deixar o histórico torto.

update public.contracts
   set rent_amount = 900
 where id = '1a667dae-19d1-44fb-b88b-8d5877cf157a'
   and rent_amount = 9
   and deposit = 900;

-- ---------------------------------------------------------------------
-- 2.5 tenants.cpf de jsonb para text
-- ---------------------------------------------------------------------
-- Os 32 registros são strings JSON ("005.646.665-05"), nenhum nulo e
-- nenhum objeto. `#>> '{}'` extrai o texto sem as aspas; um cast direto
-- para text traria as aspas junto.

alter table public.tenants
  alter column cpf type text using cpf #>> '{}';

commit;

-- ---------------------------------------------------------------------
-- Conferência depois de rodar
-- ---------------------------------------------------------------------
-- select table_name, column_name, data_type, numeric_scale
--   from information_schema.columns
--  where table_schema = 'public'
--    and (table_name, column_name) in (
--      ('finances','amount'), ('properties','rent'),
--      ('contracts','rent_amount'), ('contracts','deposit'), ('tenants','cpf'));
--
-- select rent from public.properties
--  where id = '0a88b691-f6f4-45e6-9a6a-3eb9ede28392';  -- 900.00
--
-- select cpf from public.tenants limit 3;  -- sem aspas
--
-- Rollback do dado (a estrutura volta com o ALTER inverso):
-- update public.finances f set amount = b.amount
--   from backup.lote2_20260921_finances_amount b where b.id = f.id;

-- ---------------------------------------------------------------------
-- Fora deste arquivo, de propósito
-- ---------------------------------------------------------------------
-- 2.4 — os três contratos `ended` de 19/12/2025 (32, 40 e 40) ficam
--       como estão, por decisão de 21/09/2026: é histórico encerrado,
--       não entra em cálculo nenhum, e o registro não diz qual seria o
--       valor certo. O quarto, de 16/06/2026, foi corrigido acima.
--
-- tenants.rent_amount, tenants.deposit — continuam integer. Estão nulas
--       nos 32 registros e o app não escreve nelas; o Lote 3 decide se
--       somem de vez.
