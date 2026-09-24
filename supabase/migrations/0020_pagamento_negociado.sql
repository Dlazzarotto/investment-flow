-- 0020 — Forma de pagamento é o CRONOGRAMA negociado, não a carta de crédito
--
-- A 0018 tratou LC como forma de pagamento. Para a DSD a carta de crédito (DLC,
-- SBLC, LC) é GARANTIA — ela já mora em `instrumentos` (0019), recebida e
-- administrada pelo Financial Partner. O pagamento é o que as partes negociam:
--
--   * X % antecipado e o restante na BL;
--   * 100 % na BL;
--   * venda FOB dentro do país: pagamento no CARREGAMENTO do caminhão (não há BL);
--   * saldo N dias depois do carregamento, da BL, da apresentação de documentos
--     ou da descarga.
--
-- Por isso: `pct_antecipado` (0–100) + `evento_saldo` (carregamento, bl, documentos, descarga)
-- + o `prazo_pagamento_dias` que já existia (dias depois do evento). A fatura
-- provisória (`pct_provisoria`) continua opcional.
--
-- `forma_pagamento` fica obsoleta: sai da tela, deixa de ser obrigatória e os
-- contratos existentes são convertidos (TT contra documentos → saldo na
-- apresentação de documentos; o resto → saldo na BL).
--
-- Sem função. Idempotente. Depende de 0018. Teste: tests/schema11.test.sql.

-- ---------------------------------------------------------------------------
-- BLOCO 1 — tipo
-- ---------------------------------------------------------------------------
do $e1$ begin
  create type public.evento_saldo as enum ('carregamento', 'bl', 'documentos', 'descarga');
exception when duplicate_object then null; end $e1$;

-- ---------------------------------------------------------------------------
-- BLOCO 2 — colunas novas
-- ---------------------------------------------------------------------------
alter table public.contratos add column if not exists pct_antecipado numeric(5,2) not null default 0;

alter table public.contratos add column if not exists evento_saldo public.evento_saldo not null default 'bl';

alter table public.contratos drop constraint if exists contratos_antecipado_ck;

alter table public.contratos add constraint contratos_antecipado_ck check (pct_antecipado between 0 and 100);

-- ---------------------------------------------------------------------------
-- BLOCO 3 — converte os contratos existentes e aposenta a coluna antiga
-- ---------------------------------------------------------------------------
update public.contratos set evento_saldo = 'documentos'
 where forma_pagamento = 'tt_documentos' and evento_saldo = 'bl';

alter table public.contratos alter column forma_pagamento drop not null;

alter table public.contratos alter column forma_pagamento drop default;

comment on column public.contratos.forma_pagamento is
  'OBSOLETA desde a 0020: carta de crédito é garantia (tabela instrumentos); o pagamento é pct_antecipado + evento_saldo + prazo_pagamento_dias.';

-- ---------------------------------------------------------------------------
-- BLOCO 4 — conferência: tem que voltar true nas duas colunas.
-- ---------------------------------------------------------------------------
select exists (select 1 from information_schema.columns
                where table_name = 'contratos' and column_name = 'evento_saldo') as pagamento_novo,
       (select is_nullable = 'YES' from information_schema.columns
         where table_name = 'contratos' and column_name = 'forma_pagamento') as lc_aposentada;
