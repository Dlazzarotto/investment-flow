-- 0029 — Catálogo em árvore, cadastro de Locais e os termos completos do contrato
--
-- Decisões do usuário:
--   * Grupo → Commodity → Grade → Specification. A especificação é POR GRADE
--     (Iron Ore Fines 62 % ≠ Lump 65 %); parâmetro sem grade é o padrão da
--     commodity, que o grade herda.
--   * Grupos: lista pronta do mercado (organizacao_id vazio, igual para todas as
--     empresas, rótulo traduzido pelo `codigo`) + os que a empresa criar.
--   * Locais (mina, porto, terminal fluvial, armazém, ferrovia, cidade) num
--     cadastro da empresa, com país e calado máximo — origem, ponto de carga, de
--     descarga, transbordo e destino final são escolhidos dessa lista.
--   * O contrato ganha os termos que faltavam: grade, especificação, packing,
--     base de preço, rota e logística (navio, barcaça, hidrovia, transbordo,
--     calado, frete, demurrage, entrega interior), inspeção e documentos exigidos.
--     O navio REAL de cada carga fica para os embarques (próxima etapa); aqui vão
--     os termos combinados e o navio nomeado, quando houver.
--
-- "Mesma empresa" por chave estrangeira COMPOSTA (nada de trigger). Sem PL/pgSQL.
-- Idempotente. Teste: tests/schema19.test.sql.

-- ---------------------------------------------------------------------------
-- BLOCO 1 — tipos
-- ---------------------------------------------------------------------------
do $t1$ begin
  create type public.tipo_local as enum ('mina', 'porto', 'terminal_fluvial', 'armazem', 'ferrovia', 'cidade', 'outro');
exception when duplicate_object then null; end $t1$;

do $t2$ begin
  create type public.embalagem as enum ('granel', 'big_bag', 'sacaria', 'conteiner', 'tambor', 'isotanque', 'outro');
exception when duplicate_object then null; end $t2$;

do $t3$ begin
  create type public.base_preco as enum ('mt', 'wmt', 'dmt', 'dmtu', 'bbl', 'mmbtu', 'lb', 'oz', 'bushel', 'unidade');
exception when duplicate_object then null; end $t3$;

do $t4$ begin
  create type public.porte_navio as enum
    ('handysize', 'handymax', 'supramax', 'ultramax', 'panamax', 'kamsarmax', 'post_panamax', 'capesize', 'vloc',
     'tanque_mr', 'aframax', 'suezmax', 'vlcc', 'conteineiro', 'outro');
exception when duplicate_object then null; end $t4$;

do $t5$ begin
  create type public.local_inspecao as enum ('carregamento', 'descarga', 'ambos');
exception when duplicate_object then null; end $t5$;

do $t6$ begin
  create type public.parte_responsavel as enum ('vendedor', 'comprador', 'dividido');
exception when duplicate_object then null; end $t6$;

do $t7$ begin
  create type public.modal_interior as enum ('caminhao', 'ferrovia', 'barcaca', 'duto', 'nenhuma');
exception when duplicate_object then null; end $t7$;

-- ---------------------------------------------------------------------------
-- BLOCO 2 — grupos de commodity (lista pronta + da empresa)
-- ---------------------------------------------------------------------------
create table if not exists public.commodity_grupos (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid references public.organizacoes (id) on delete cascade,
  codigo         text check (codigo is null or codigo ~ '^[a-z_]{2,40}$'),
  nome           text check (nome is null or char_length(trim(nome)) between 1 and 80),
  ordem          int not null default 100,
  criado_em      timestamptz not null default now(),
  -- Padrão: sem empresa, com código (o rótulo vem do dicionário). Da empresa: com nome.
  constraint commodity_grupos_tipo_ck check (
    (organizacao_id is null and codigo is not null) or (organizacao_id is not null and nome is not null))
);

create unique index if not exists commodity_grupos_codigo_uq on public.commodity_grupos (codigo) where organizacao_id is null;

create unique index if not exists commodity_grupos_nome_uq
  on public.commodity_grupos (organizacao_id, lower(trim(nome))) where organizacao_id is not null;

insert into public.commodity_grupos (codigo, ordem) values
  ('minerios', 10), ('metais_basicos', 20), ('metais_preciosos', 30), ('petroleo_derivados', 40),
  ('gas_natural', 50), ('carvao', 60), ('graos_oleaginosas', 70), ('softs', 80),
  ('fertilizantes', 90), ('quimicos', 100), ('proteinas', 110), ('florestais', 120)
on conflict do nothing;

alter table public.commodity_grupos enable row level security;

drop policy if exists commodity_grupos_ver on public.commodity_grupos;

create policy commodity_grupos_ver on public.commodity_grupos for select to authenticated
  using (organizacao_id is null or public.eh_admin_organizacao(organizacao_id));

drop policy if exists commodity_grupos_escrever on public.commodity_grupos;

create policy commodity_grupos_escrever on public.commodity_grupos for all to authenticated
  using (organizacao_id is not null and public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id))
  with check (organizacao_id is not null and public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id));

grant select, insert, update, delete on public.commodity_grupos to authenticated;

-- ---------------------------------------------------------------------------
-- BLOCO 3 — a commodity pertence a um grupo (padrão ou da própria empresa)
-- ---------------------------------------------------------------------------
alter table public.commodities add column if not exists grupo_id uuid references public.commodity_grupos (id) on delete set null;

-- RESTRITIVA: o grupo tem que ser da lista pronta ou da mesma empresa. A consulta
-- roda com o RLS de quem grava, que só enxerga os grupos padrão e os seus.
drop policy if exists commodities_grupo_valido on public.commodities;

create policy commodities_grupo_valido on public.commodities as restrictive for all to authenticated
  using (true)
  with check (grupo_id is null or exists (
    select 1 from public.commodity_grupos g
     where g.id = grupo_id and (g.organizacao_id is null or g.organizacao_id = commodities.organizacao_id)));

-- ---------------------------------------------------------------------------
-- BLOCO 4 — grades
-- ---------------------------------------------------------------------------
create table if not exists public.commodity_grades (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  commodity_id   uuid not null,
  nome           text not null check (char_length(trim(nome)) between 1 and 120),
  observacoes    text check (observacoes is null or char_length(observacoes) <= 2000),
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  constraint commodity_grades_commodity_fk foreign key (commodity_id, organizacao_id)
    references public.commodities (id, organizacao_id) on delete cascade
);

create unique index if not exists commodity_grades_nome_uq on public.commodity_grades (commodity_id, lower(trim(nome)));

create unique index if not exists commodity_grades_id_commodity_uq on public.commodity_grades (id, commodity_id);

alter table public.commodity_grades enable row level security;

drop policy if exists commodity_grades_ver on public.commodity_grades;

create policy commodity_grades_ver on public.commodity_grades for select to authenticated
  using (public.eh_admin_organizacao(organizacao_id));

drop policy if exists commodity_grades_escrever on public.commodity_grades;

create policy commodity_grades_escrever on public.commodity_grades for all to authenticated
  using (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id))
  with check (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id));

grant select, insert, update, delete on public.commodity_grades to authenticated;

drop trigger if exists historico_commodity_grades on public.commodity_grades;

create trigger historico_commodity_grades after insert or update or delete on public.commodity_grades
  for each row execute function public.tg_historico();

-- Especificação por grade: parâmetro com grade_id é do grade; sem, é o padrão da
-- commodity. A chave composta garante que o grade é DESSA commodity.
alter table public.commodity_parametros add column if not exists grade_id uuid;

alter table public.commodity_parametros drop constraint if exists commodity_parametros_grade_fk;

alter table public.commodity_parametros add constraint commodity_parametros_grade_fk
  foreign key (grade_id, commodity_id) references public.commodity_grades (id, commodity_id) on delete cascade;

-- ---------------------------------------------------------------------------
-- BLOCO 5 — locais
-- ---------------------------------------------------------------------------
create table if not exists public.locais (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  nome           text not null check (char_length(trim(nome)) between 1 and 160),
  tipo           public.tipo_local not null default 'porto',
  pais           text check (pais is null or char_length(pais) <= 80),
  regiao         text check (regiao is null or char_length(regiao) <= 120),
  unlocode       text check (unlocode is null or unlocode ~ '^[A-Z]{2} ?[A-Z0-9]{3}$'),
  calado_max_m   numeric(5,2) check (calado_max_m is null or calado_max_m between 0 and 40),
  observacoes    text check (observacoes is null or char_length(observacoes) <= 2000),
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now()
);

create unique index if not exists locais_nome_uq on public.locais (organizacao_id, lower(trim(nome)));

create unique index if not exists locais_id_org_uq on public.locais (id, organizacao_id);

alter table public.locais enable row level security;

drop policy if exists locais_ver on public.locais;

create policy locais_ver on public.locais for select to authenticated
  using (public.eh_admin_organizacao(organizacao_id));

drop policy if exists locais_escrever on public.locais;

create policy locais_escrever on public.locais for all to authenticated
  using (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id))
  with check (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id));

grant select, insert, update, delete on public.locais to authenticated;

drop trigger if exists historico_locais on public.locais;

create trigger historico_locais after insert or update or delete on public.locais
  for each row execute function public.tg_historico();

-- ---------------------------------------------------------------------------
-- BLOCO 6 — contrato: produto, preço, rota, logística, inspeção, documentos
-- ---------------------------------------------------------------------------
alter table public.contratos
  add column if not exists grade_id             uuid,
  add column if not exists especificacao        text check (especificacao is null or char_length(especificacao) <= 2000),
  add column if not exists embalagem            public.embalagem,
  add column if not exists base_preco           public.base_preco,
  add column if not exists origem_id            uuid,
  add column if not exists ponto_carga_id       uuid,
  add column if not exists destino              text check (destino is null or char_length(destino) <= 160),
  add column if not exists ponto_descarga_id    uuid,
  add column if not exists destino_final_id     uuid,
  add column if not exists transbordo_id        uuid,
  add column if not exists rota_fluvial         text check (rota_fluvial is null or char_length(rota_fluvial) <= 300),
  add column if not exists barcacas_qtd         int check (barcacas_qtd is null or barcacas_qtd between 0 and 500),
  add column if not exists barcaca_obs          text check (barcaca_obs is null or char_length(barcaca_obs) <= 300),
  add column if not exists porte_navio          public.porte_navio,
  add column if not exists navio_nome           text check (navio_nome is null or char_length(navio_nome) <= 120),
  add column if not exists navio_imo            text check (navio_imo is null or navio_imo ~ '^[0-9]{7}$'),
  add column if not exists calado_max_m         numeric(5,2) check (calado_max_m is null or calado_max_m between 0 and 40),
  add column if not exists frete_valor          numeric(14,2) check (frete_valor is null or frete_valor >= 0),
  add column if not exists taxa_carga_dia       numeric(12,2) check (taxa_carga_dia is null or taxa_carga_dia > 0),
  add column if not exists taxa_descarga_dia    numeric(12,2) check (taxa_descarga_dia is null or taxa_descarga_dia > 0),
  add column if not exists demurrage_dia        numeric(14,2) check (demurrage_dia is null or demurrage_dia >= 0),
  add column if not exists despatch_dia         numeric(14,2) check (despatch_dia is null or despatch_dia >= 0),
  add column if not exists entrega_interior     public.modal_interior,
  add column if not exists entrega_interior_obs text check (entrega_interior_obs is null or char_length(entrega_interior_obs) <= 300),
  add column if not exists inspetora            text check (inspetora is null or char_length(inspetora) <= 120),
  add column if not exists inspecao_local       public.local_inspecao,
  add column if not exists inspecao_custo       public.parte_responsavel,
  add column if not exists documentos_exigidos  text[] not null default '{}';

-- Documentos: lista fechada de códigos (o rótulo vem do dicionário, nos 4 idiomas).
alter table public.contratos drop constraint if exists contratos_documentos_ck;

alter table public.contratos add constraint contratos_documentos_ck check (documentos_exigidos <@ array[
  'bl', 'fatura_comercial', 'packing_list', 'certificado_origem', 'certificado_qualidade', 'certificado_peso',
  'draft_survey', 'apolice_seguro', 'fitossanitario', 'nao_radioatividade', 'certificado_fumigacao', 'mates_receipt'
]::text[]);

-- Mesma empresa (locais) e mesma commodity (grade), por chave composta.
alter table public.contratos drop constraint if exists contratos_grade_fk;

alter table public.contratos add constraint contratos_grade_fk foreign key (grade_id, commodity_id)
  references public.commodity_grades (id, commodity_id) on delete set null (grade_id);

alter table public.contratos drop constraint if exists contratos_origem_fk;

alter table public.contratos add constraint contratos_origem_fk foreign key (origem_id, organizacao_id)
  references public.locais (id, organizacao_id) on delete set null (origem_id);

alter table public.contratos drop constraint if exists contratos_ponto_carga_fk;

alter table public.contratos add constraint contratos_ponto_carga_fk foreign key (ponto_carga_id, organizacao_id)
  references public.locais (id, organizacao_id) on delete set null (ponto_carga_id);

alter table public.contratos drop constraint if exists contratos_ponto_descarga_fk;

alter table public.contratos add constraint contratos_ponto_descarga_fk foreign key (ponto_descarga_id, organizacao_id)
  references public.locais (id, organizacao_id) on delete set null (ponto_descarga_id);

alter table public.contratos drop constraint if exists contratos_destino_final_fk;

alter table public.contratos add constraint contratos_destino_final_fk foreign key (destino_final_id, organizacao_id)
  references public.locais (id, organizacao_id) on delete set null (destino_final_id);

alter table public.contratos drop constraint if exists contratos_transbordo_fk;

alter table public.contratos add constraint contratos_transbordo_fk foreign key (transbordo_id, organizacao_id)
  references public.locais (id, organizacao_id) on delete set null (transbordo_id);

-- ---------------------------------------------------------------------------
-- BLOCO 7 — conferência: tem que voltar true nas quatro colunas.
-- ---------------------------------------------------------------------------
select (select count(*) from public.commodity_grupos where organizacao_id is null) = 12 as grupos_padrao,
       to_regclass('public.commodity_grades') is not null as grades,
       to_regclass('public.locais') is not null as locais,
       exists (select 1 from information_schema.columns
                where table_name = 'contratos' and column_name = 'documentos_exigidos') as termos_contrato;
