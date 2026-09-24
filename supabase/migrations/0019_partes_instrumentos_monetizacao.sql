-- 0019 — Partes do contrato, instrumentos bancários, monetização e remuneração da gestão
--
-- Como o usuário descreveu a operação:
--
--   CONTRATO DE COMPRA E VENDA (commodity)
--     partes: comprador, vendedor e o FINANCIAL PARTNER, que recebe e administra o
--     instrumento bancário (DLC / SBLC / LC) — sem responsabilidade sobre o produto.
--     A DSD é trader (compra/vende por conta própria) ou intermediária (comissão
--     por unidade ou % do valor).
--       └─ CONTRATO DE MONETIZAÇÃO: Financial Partner ↔ vendedor. A DSD negocia:
--          o Financial Partner paga um % do valor de FACE (ex.: 35 %), esse valor
--          vai para o vendedor ou para o projeto, e a DSD ganha % do valor
--          MONETIZADO (ex.: 5 %), não do valor de face.
--
-- E, para a operação sob gestão (projeto de investidores):
--   * o contrato diz POR CONTA DE QUEM é (DSD ou projeto) e QUEM ASSINA — o
--     resultado segue a conta, a assinatura é só jurídica;
--   * o projeto tem a REMUNERAÇÃO DA GESTÃO (taxa de administração, % sobre
--     vendas, por unidade, performance) — o que a DSD ganha por administrar.
--
-- Todos continuam sendo CLIENTES para a DSD (decisão do usuário): o Financial
-- Partner é mais um tipo, ao lado de comprador, vendedor, investidor, monetizador.
--
-- Sem nenhuma função nova: travas por check e por chave estrangeira composta
-- (id, organizacao_id) — o SQL Editor do Supabase quebrou corpo de função na
-- 0010, na 0012 e na 0018. Idempotente. Depende de 0018.
-- Teste: tests/schema10.test.sql.

-- ---------------------------------------------------------------------------
-- BLOCO 1 — tipos
-- ---------------------------------------------------------------------------
alter type public.tipo_cliente add value if not exists 'financial_partner';

do $u1$ begin
  create type public.papel_parte as enum ('comprador', 'vendedor', 'financial_partner');
exception when duplicate_object then null; end $u1$;

do $u2$ begin
  create type public.conta_contrato as enum ('propria', 'projeto');
exception when duplicate_object then null; end $u2$;

do $u3$ begin
  create type public.assinante_contrato as enum ('empresa', 'projeto');
exception when duplicate_object then null; end $u3$;

do $u4$ begin
  create type public.tipo_instrumento as enum ('dlc', 'sblc', 'lc');
exception when duplicate_object then null; end $u4$;

do $u5$ begin
  create type public.status_instrumento as enum
    ('solicitado', 'emitido', 'recebido', 'monetizado', 'liquidado', 'vencido', 'cancelado');
exception when duplicate_object then null; end $u5$;

do $u6$ begin
  create type public.status_monetizacao as enum ('negociacao', 'aprovada', 'paga', 'cancelada');
exception when duplicate_object then null; end $u6$;

do $u7$ begin
  create type public.tipo_remuneracao as enum
    ('taxa_adm_anual_pct', 'fixo_mensal', 'pct_vendas', 'por_unidade', 'performance_pct');
exception when duplicate_object then null; end $u7$;

-- ---------------------------------------------------------------------------
-- BLOCO 2 — contrato: por conta de quem, quem assina
-- ---------------------------------------------------------------------------
alter table public.contratos add column if not exists conta public.conta_contrato not null default 'propria';

alter table public.contratos add column if not exists assinante public.assinante_contrato not null default 'empresa';

-- Por conta do projeto (ou assinado pela JV) só existe com projeto escolhido.
alter table public.contratos drop constraint if exists contratos_conta_ck;

alter table public.contratos add constraint contratos_conta_ck
  check ((conta = 'propria' or projeto_id is not null) and (assinante = 'empresa' or projeto_id is not null));

-- As partes agora moram em contrato_partes (BLOCO 3). A coluna antiga fica
-- opcional e sem uso na aplicação — apagar agora tornaria esta migration
-- impossível de rodar de novo.
alter table public.contratos alter column contraparte_id drop not null;

-- As tabelas filhas apontam para (id, organizacao_id) do contrato.
create unique index if not exists contratos_id_org_uq on public.contratos (id, organizacao_id);

-- ---------------------------------------------------------------------------
-- BLOCO 3 — partes do contrato
-- ---------------------------------------------------------------------------
create table if not exists public.contrato_partes (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  contrato_id    uuid not null,
  cliente_id     uuid not null,
  papel          public.papel_parte not null,
  criado_em      timestamptz not null default now(),
  constraint contrato_partes_contrato_fk foreign key (contrato_id, organizacao_id)
    references public.contratos (id, organizacao_id) on delete cascade,
  -- restrict: o cliente que é parte de um contrato não some.
  constraint contrato_partes_cliente_fk foreign key (cliente_id, organizacao_id)
    references public.clientes (id, organizacao_id) on delete restrict
);

-- Um comprador, um vendedor e um Financial Partner por contrato.
create unique index if not exists contrato_partes_papel_uq on public.contrato_partes (contrato_id, papel);

create index if not exists contrato_partes_cliente_idx on public.contrato_partes (cliente_id);

-- Os contratos que já existem: a contraparte de uma venda é o comprador; de uma compra, o vendedor.
insert into public.contrato_partes (organizacao_id, contrato_id, cliente_id, papel)
select c.organizacao_id, c.id, c.contraparte_id,
       case c.direcao when 'venda' then 'comprador'::public.papel_parte else 'vendedor'::public.papel_parte end
  from public.contratos c
 where c.contraparte_id is not null
on conflict (contrato_id, papel) do nothing;

-- ---------------------------------------------------------------------------
-- BLOCO 4 — instrumentos bancários do contrato
-- ---------------------------------------------------------------------------
create table if not exists public.instrumentos (
  id                   uuid primary key default gen_random_uuid(),
  organizacao_id       uuid not null references public.organizacoes (id) on delete cascade,
  contrato_id          uuid not null,
  tipo                 public.tipo_instrumento not null default 'dlc',
  -- Quem recebe e administra; pode ficar vazio enquanto o instrumento é só pedido.
  financial_partner_id uuid,
  banco_emissor        text check (banco_emissor is null or char_length(banco_emissor) <= 160),
  numero               text check (numero is null or char_length(numero) <= 80),
  valor_face           numeric(16,2) not null check (valor_face > 0),
  moeda                public.moeda not null default 'USD',
  data_emissao         date,
  validade             date,
  -- Prazo para apresentar documentos: perder é perder o pagamento. O painel alerta.
  prazo_apresentacao   date,
  status               public.status_instrumento not null default 'solicitado',
  observacoes          text check (observacoes is null or char_length(observacoes) <= 2000),
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  constraint instrumentos_contrato_fk foreign key (contrato_id, organizacao_id)
    references public.contratos (id, organizacao_id) on delete cascade,
  constraint instrumentos_fp_fk foreign key (financial_partner_id, organizacao_id)
    references public.clientes (id, organizacao_id) on delete restrict,
  constraint instrumentos_datas_ck check (validade is null or data_emissao is null or validade >= data_emissao)
);

create index if not exists instrumentos_contrato_idx on public.instrumentos (contrato_id);

create index if not exists instrumentos_org_idx on public.instrumentos (organizacao_id, status);

create unique index if not exists instrumentos_id_org_uq on public.instrumentos (id, organizacao_id);

-- ---------------------------------------------------------------------------
-- BLOCO 5 — contratos de monetização
-- ---------------------------------------------------------------------------
create table if not exists public.monetizacoes (
  id                   uuid primary key default gen_random_uuid(),
  organizacao_id       uuid not null references public.organizacoes (id) on delete cascade,
  numero               text check (numero is null or char_length(trim(numero)) between 1 and 60),
  instrumento_id       uuid not null,
  financial_partner_id uuid not null,
  -- Quem recebe o valor monetizado: o vendedor (cliente) ou o projeto.
  beneficiario_id      uuid,
  projeto_id           uuid,
  -- % do valor de FACE que o Financial Partner paga (ex.: 35).
  pct_monetizacao      numeric(5,2) not null check (pct_monetizacao > 0 and pct_monetizacao <= 100),
  -- % do valor MONETIZADO que a DSD ganha (ex.: 5).
  comissao_pct         numeric(5,2) not null default 0 check (comissao_pct between 0 and 100),
  status               public.status_monetizacao not null default 'negociacao',
  data_oferta          date,
  data_pagamento       date,
  observacoes          text check (observacoes is null or char_length(observacoes) <= 2000),
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  constraint monetizacoes_instrumento_fk foreign key (instrumento_id, organizacao_id)
    references public.instrumentos (id, organizacao_id) on delete restrict,
  constraint monetizacoes_fp_fk foreign key (financial_partner_id, organizacao_id)
    references public.clientes (id, organizacao_id) on delete restrict,
  constraint monetizacoes_beneficiario_fk foreign key (beneficiario_id, organizacao_id)
    references public.clientes (id, organizacao_id) on delete restrict,
  constraint monetizacoes_projeto_fk foreign key (projeto_id, organizacao_id)
    references public.projetos (id, organizacao_id) on delete set null (projeto_id),
  -- O dinheiro vai para ALGUÉM: vendedor ou projeto, um dos dois.
  constraint monetizacoes_destino_ck check (beneficiario_id is not null or projeto_id is not null)
);

create index if not exists monetizacoes_instrumento_idx on public.monetizacoes (instrumento_id);

create unique index if not exists monetizacoes_numero_uq
  on public.monetizacoes (organizacao_id, lower(trim(numero))) where numero is not null;

-- ---------------------------------------------------------------------------
-- BLOCO 6 — remuneração da gestão (o que a DSD ganha por administrar um projeto)
-- ---------------------------------------------------------------------------
create table if not exists public.remuneracoes_gestao (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  projeto_id     uuid not null,
  tipo           public.tipo_remuneracao not null,
  -- % para taxa_adm_anual_pct, pct_vendas e performance_pct; valor para fixo_mensal e por_unidade.
  valor          numeric(16,4) not null check (valor > 0),
  inicio         date,
  fim            date,
  observacoes    text check (observacoes is null or char_length(observacoes) <= 1000),
  criado_em      timestamptz not null default now(),
  constraint remuneracoes_projeto_fk foreign key (projeto_id, organizacao_id)
    references public.projetos (id, organizacao_id) on delete cascade,
  constraint remuneracoes_pct_ck check (
    tipo not in ('taxa_adm_anual_pct', 'pct_vendas', 'performance_pct') or valor <= 100),
  constraint remuneracoes_periodo_ck check (fim is null or inicio is null or fim >= inicio)
);

create index if not exists remuneracoes_projeto_idx on public.remuneracoes_gestao (projeto_id);

-- ---------------------------------------------------------------------------
-- BLOCO 7 — acesso: administração da empresa lê; escrever exige empresa em dia
-- ---------------------------------------------------------------------------
-- Nada aqui menciona eh_master, e o investidor não é membro de organização: ele
-- não vê instrumento, monetização nem quanto a DSD cobra de gestão.
alter table public.contrato_partes enable row level security;

alter table public.instrumentos enable row level security;

alter table public.monetizacoes enable row level security;

alter table public.remuneracoes_gestao enable row level security;

drop policy if exists contrato_partes_ver on public.contrato_partes;

create policy contrato_partes_ver on public.contrato_partes for select to authenticated
  using (public.eh_admin_organizacao(organizacao_id));

drop policy if exists contrato_partes_escrever on public.contrato_partes;

create policy contrato_partes_escrever on public.contrato_partes for all to authenticated
  using (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id))
  with check (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id));

drop policy if exists instrumentos_ver on public.instrumentos;

create policy instrumentos_ver on public.instrumentos for select to authenticated
  using (public.eh_admin_organizacao(organizacao_id));

drop policy if exists instrumentos_escrever on public.instrumentos;

create policy instrumentos_escrever on public.instrumentos for all to authenticated
  using (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id))
  with check (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id));

drop policy if exists monetizacoes_ver on public.monetizacoes;

create policy monetizacoes_ver on public.monetizacoes for select to authenticated
  using (public.eh_admin_organizacao(organizacao_id));

drop policy if exists monetizacoes_escrever on public.monetizacoes;

create policy monetizacoes_escrever on public.monetizacoes for all to authenticated
  using (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id))
  with check (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id));

drop policy if exists remuneracoes_ver on public.remuneracoes_gestao;

create policy remuneracoes_ver on public.remuneracoes_gestao for select to authenticated
  using (public.eh_admin_organizacao(organizacao_id));

drop policy if exists remuneracoes_escrever on public.remuneracoes_gestao;

create policy remuneracoes_escrever on public.remuneracoes_gestao for all to authenticated
  using (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id))
  with check (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id));

grant select, insert, update, delete on public.contrato_partes, public.instrumentos,
  public.monetizacoes, public.remuneracoes_gestao to authenticated;

-- ---------------------------------------------------------------------------
-- BLOCO 8 — projeto só entra em empresa da qual quem grava é sócio
-- ---------------------------------------------------------------------------
-- O RLS de projetos deixa o DONO gravar qualquer organizacao_id — o papel dele é
-- "dono" em qualquer caso. Pela API, dava para enfiar um projeto dentro da empresa
-- de outra pessoa (e os ADMs dela virariam admins dele). A tela conferia; o banco
-- não. Política RESTRITIVA: soma-se às que já existem em vez de substituí-las.
drop policy if exists projetos_empresa_propria on public.projetos;

create policy projetos_empresa_propria on public.projetos as restrictive
  for insert to authenticated
  with check (organizacao_id is null or public.eh_admin_organizacao(organizacao_id));

drop policy if exists projetos_empresa_propria_alterar on public.projetos;

create policy projetos_empresa_propria_alterar on public.projetos as restrictive
  for update to authenticated
  using (true)
  with check (organizacao_id is null or public.eh_admin_organizacao(organizacao_id));

-- ---------------------------------------------------------------------------
-- BLOCO 9 — histórico
-- ---------------------------------------------------------------------------
drop trigger if exists historico_contrato_partes on public.contrato_partes;

create trigger historico_contrato_partes after insert or update or delete on public.contrato_partes
  for each row execute function public.tg_historico();

drop trigger if exists historico_instrumentos on public.instrumentos;

create trigger historico_instrumentos after insert or update or delete on public.instrumentos
  for each row execute function public.tg_historico();

drop trigger if exists historico_monetizacoes on public.monetizacoes;

create trigger historico_monetizacoes after insert or update or delete on public.monetizacoes
  for each row execute function public.tg_historico();

drop trigger if exists historico_remuneracoes on public.remuneracoes_gestao;

create trigger historico_remuneracoes after insert or update or delete on public.remuneracoes_gestao
  for each row execute function public.tg_historico('projeto_id');

-- ---------------------------------------------------------------------------
-- BLOCO 10 — conferência: tem que voltar true em todas as colunas.
-- ---------------------------------------------------------------------------
select (select count(*) from information_schema.tables where table_schema = 'public'
          and table_name in ('contrato_partes', 'instrumentos', 'monetizacoes', 'remuneracoes_gestao')) = 4 as tabelas,
       (select count(*) from pg_policies where tablename in
          ('contrato_partes', 'instrumentos', 'monetizacoes', 'remuneracoes_gestao')) = 8 as politicas,
       exists (select 1 from pg_policies where policyname = 'projetos_empresa_propria_alterar') as trava_projeto,
       exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                where t.typname = 'tipo_cliente' and e.enumlabel = 'financial_partner') as financial_partner;
