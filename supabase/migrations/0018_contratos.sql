-- 0018 — Contratos comerciais (etapa 1 da espinha da operação)
--
-- Até aqui a venda era uma linha solta dentro de um projeto: volume × preço ×
-- data, sem cliente, sem commodity, sem contrato. Por isso o painel não sabia
-- dizer quanto falta embarcar nem quanto falta receber.
--
-- O contrato passa a ser o centro da operação:
--   proposta (estimativa de custo) → LOI / ICPO → SCO → CONTRATO → embarques
--   (0019) → faturas e recebimentos (0020).
--
-- Decisões fechadas com o usuário:
--   * A empresa atua como TRADER (compra e revende: contrato de compra com o
--     vendedor + contrato de venda com o comprador, casados no embarque) e como
--     AGENTE (um contrato só, ganha comissão). `direcao` e `papel` dizem qual.
--   * Preço FIXO ou por FÓRMULA (índice ± prêmio no período de cotação); o
--     ajuste de qualidade entra no embarque, pelo laudo.
--   * Pagamento por CARTA DE CRÉDITO ou TT CONTRA DOCUMENTOS, com fatura
--     provisória opcional.
--   * Projeto é AGRUPADOR OPCIONAL (JV / investidor), não o dono do contrato.
--
-- Contraparte vem de `clientes` (comprador, vendedor…); fornecedor é prestador
-- de serviço e entra nos custos do embarque, não aqui.
--
-- Blocos curtos e SEM função: a trava de empresa é chave estrangeira composta. Idempotente.
-- Depende de 0007, 0008, 0009, 0014 e 0015. Teste: tests/schema9.test.sql.

-- ---------------------------------------------------------------------------
-- BLOCO 1 — tipos
-- ---------------------------------------------------------------------------
do $t1$ begin
  create type public.direcao_contrato as enum ('venda', 'compra');
exception when duplicate_object then null; end $t1$;

do $t2$ begin
  create type public.papel_contrato as enum ('principal', 'agente');
exception when duplicate_object then null; end $t2$;

do $t3$ begin
  create type public.modalidade_contrato as enum ('spot', 'term');
exception when duplicate_object then null; end $t3$;

do $t4$ begin
  create type public.tipo_preco as enum ('fixo', 'formula');
exception when duplicate_object then null; end $t4$;

do $t5$ begin
  create type public.forma_pagamento as enum ('lc', 'tt_documentos');
exception when duplicate_object then null; end $t5$;

do $t6$ begin
  create type public.status_contrato as enum ('rascunho', 'assinado', 'em_execucao', 'concluido', 'cancelado');
exception when duplicate_object then null; end $t6$;

do $t7$ begin
  create type public.incoterm as enum ('EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP');
exception when duplicate_object then null; end $t7$;

do $t8$ begin
  create type public.base_comissao as enum ('por_unidade', 'pct_valor');
exception when duplicate_object then null; end $t8$;

-- ---------------------------------------------------------------------------
-- BLOCO 2 — contratos
-- ---------------------------------------------------------------------------
create table if not exists public.contratos (
  id                    uuid primary key default gen_random_uuid(),
  organizacao_id        uuid not null references public.organizacoes (id) on delete cascade,
  -- Referência interna (ex.: "DSD-2026-014"); opcional, única na empresa.
  numero                text check (numero is null or char_length(trim(numero)) between 1 and 60),
  -- As chaves para contraparte, commodity e projeto são COMPOSTAS com a empresa
  -- (BLOCO 3): é o próprio banco que garante que tudo é da mesma empresa.
  contraparte_id        uuid not null,
  commodity_id          uuid not null,
  projeto_id            uuid,
  estimativa_id         uuid references public.estimativas_custo (id) on delete set null,

  direcao               public.direcao_contrato not null default 'venda',
  papel                 public.papel_contrato not null default 'principal',
  modalidade            public.modalidade_contrato not null default 'spot',
  status                public.status_contrato not null default 'rascunho',

  volume                numeric(14,3) not null check (volume > 0),
  -- "±10 % a critério do vendedor" é o comum em granel; acima de 50 % não é tolerância.
  tolerancia_pct        numeric(5,2) not null default 0 check (tolerancia_pct between 0 and 50),
  unidade               text not null default 'Toneladas' check (char_length(trim(unidade)) between 1 and 40),
  incoterm              public.incoterm not null default 'FOB',
  porto_embarque        text check (porto_embarque is null or char_length(porto_embarque) <= 160),
  porto_destino         text check (porto_destino is null or char_length(porto_destino) <= 160),
  moeda                 public.moeda not null default 'USD',

  tipo_preco            public.tipo_preco not null default 'fixo',
  preco_fixo            numeric(16,2) check (preco_fixo is null or preco_fixo > 0),
  indice                text check (indice is null or char_length(trim(indice)) between 1 and 160),
  -- Pode ser negativo: desconto sobre o índice.
  premio                numeric(16,2) not null default 0,
  periodo_cotacao       text check (periodo_cotacao is null or char_length(periodo_cotacao) <= 160),
  -- Valor do índice usado só para PROJETAR o valor do contrato; o preço real
  -- sai do índice do período de cotação, no embarque.
  indice_referencia     numeric(16,2) check (indice_referencia is null or indice_referencia > 0),

  forma_pagamento       public.forma_pagamento not null default 'lc',
  prazo_pagamento_dias  int not null default 0 check (prazo_pagamento_dias between 0 and 365),
  -- null = sem fatura provisória; senão, % pago no embarque (o resto após o laudo).
  pct_provisoria        numeric(5,2) check (pct_provisoria is null or (pct_provisoria > 0 and pct_provisoria < 100)),

  comissao_base         public.base_comissao,
  comissao_valor        numeric(16,4) check (comissao_valor is null or comissao_valor > 0),

  data_loi              date,
  data_icpo             date,
  data_sco              date,
  data_assinatura       date,
  inicio_entregas       date,
  fim_entregas          date,
  observacoes           text check (observacoes is null or char_length(observacoes) <= 2000),
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),

  -- Preço fixo tem preço; fórmula tem índice. Sem isso o contrato não tem valor.
  constraint contratos_preco_ck check (
    (tipo_preco = 'fixo' and preco_fixo is not null)
    or (tipo_preco = 'formula' and indice is not null)),
  -- Agente vive da comissão: sem ela o contrato não gera receita para a empresa.
  -- Principal não leva comissão aqui (corretagem paga é custo do embarque).
  constraint contratos_comissao_ck check (
    (papel = 'agente' and comissao_base is not null and comissao_valor is not null)
    or (papel = 'principal' and comissao_base is null and comissao_valor is null)),
  constraint contratos_comissao_pct_ck check (
    comissao_base is distinct from 'pct_valor' or comissao_valor <= 100),
  constraint contratos_periodo_ck check (
    fim_entregas is null or inicio_entregas is null or fim_entregas >= inicio_entregas)
);

create index if not exists contratos_org_idx on public.contratos (organizacao_id, status);

create index if not exists contratos_contraparte_idx on public.contratos (contraparte_id);

create index if not exists contratos_commodity_idx on public.contratos (commodity_id);

create unique index if not exists contratos_numero_uq
  on public.contratos (organizacao_id, lower(trim(numero))) where numero is not null;

-- ---------------------------------------------------------------------------
-- BLOCO 3 — tudo da mesma empresa, por chave estrangeira composta
-- ---------------------------------------------------------------------------
-- Chave simples garante que a contraparte EXISTE, não que é DESTA empresa: um
-- id copiado de outra trading entraria no contrato. Com (id, organizacao_id)
-- dos dois lados, a linha só existe se contraparte, commodity e projeto forem
-- da mesma empresa do contrato. Sem função nem trigger — a primeira versão
-- desta migration usava uma trigger em PL/pgSQL e o SQL Editor do Supabase
-- partiu o corpo dela no meio ("unterminated dollar-quoted string").
--
-- A estimativa de origem fica com chave simples: não tem empresa própria (é do
-- projeto), e o RLS dela já impede ler a de outra empresa.

-- Limpa o que a primeira versão possa ter deixado, se ela entrou pela metade.
drop trigger if exists contrato_mesma_empresa on public.contratos;

drop function if exists public.tg_contrato_mesma_empresa();

alter table public.contratos drop constraint if exists contratos_contraparte_id_fkey;

alter table public.contratos drop constraint if exists contratos_commodity_id_fkey;

alter table public.contratos drop constraint if exists contratos_projeto_id_fkey;

-- O lado referenciado precisa de unicidade no par (id, empresa).
create unique index if not exists clientes_id_org_uq on public.clientes (id, organizacao_id);

create unique index if not exists commodities_id_org_uq on public.commodities (id, organizacao_id);

create unique index if not exists projetos_id_org_uq on public.projetos (id, organizacao_id);

alter table public.contratos drop constraint if exists contratos_contraparte_fk;

-- restrict: apagar o cliente não pode sumir com o contrato assinado com ele.
alter table public.contratos add constraint contratos_contraparte_fk
  foreign key (contraparte_id, organizacao_id) references public.clientes (id, organizacao_id) on delete restrict;

alter table public.contratos drop constraint if exists contratos_commodity_fk;

alter table public.contratos add constraint contratos_commodity_fk
  foreign key (commodity_id, organizacao_id) references public.commodities (id, organizacao_id) on delete restrict;

alter table public.contratos drop constraint if exists contratos_projeto_fk;

-- Projeto apagado solta o contrato (só projeto_id vira null; a empresa fica).
alter table public.contratos add constraint contratos_projeto_fk
  foreign key (projeto_id, organizacao_id) references public.projetos (id, organizacao_id) on delete set null (projeto_id);

-- ---------------------------------------------------------------------------
-- BLOCO 4 — acesso
-- ---------------------------------------------------------------------------
-- Contrato é da administração da empresa, como os cadastros. O master não lê
-- (nenhuma policy menciona eh_master) e o investidor não chega: ele nunca é
-- membro de organização. Escrever exige contrato da PLATAFORMA em dia — empresa
-- suspensa lê o que tem, mas não fecha negócio novo pelo sistema.
alter table public.contratos enable row level security;

drop policy if exists contratos_ver on public.contratos;

create policy contratos_ver on public.contratos
  for select to authenticated
  using (public.eh_admin_organizacao(organizacao_id));

drop policy if exists contratos_escrever on public.contratos;

create policy contratos_escrever on public.contratos
  for insert to authenticated
  with check (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id));

drop policy if exists contratos_alterar on public.contratos;

create policy contratos_alterar on public.contratos
  for update to authenticated
  using (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id))
  with check (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id));

drop policy if exists contratos_excluir on public.contratos;

create policy contratos_excluir on public.contratos
  for delete to authenticated
  using (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id));

grant select, insert, update, delete on public.contratos to authenticated;

-- ---------------------------------------------------------------------------
-- BLOCO 5 — histórico
-- ---------------------------------------------------------------------------
drop trigger if exists historico_contratos on public.contratos;

create trigger historico_contratos
  after insert or update or delete on public.contratos
  for each row execute function public.tg_historico();

-- ---------------------------------------------------------------------------
-- BLOCO 6 — conferência ("rodei" não é prova de que entrou inteira).
-- Tem que voltar true nas três colunas.
-- ---------------------------------------------------------------------------
select to_regclass('public.contratos') is not null as tabela,
       (select count(*) from pg_constraint where conname in ('contratos_contraparte_fk', 'contratos_commodity_fk', 'contratos_projeto_fk')) = 3 as trava_empresa,
       (select count(*) from pg_policies where tablename = 'contratos') = 4 as politicas;
