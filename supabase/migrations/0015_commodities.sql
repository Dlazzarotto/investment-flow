-- 0015 — Catálogo de commodities (etapa 3 da reorganização, parte 1)
--
-- "O custo será feito por commodities" e "se for minério, calcular a pureza".
-- As duas coisas precisam de um cadastro que hoje não existe: a commodity é
-- texto livre dentro de cada estimativa, então o mesmo minério é redigitado a
-- cada precificação e não há onde guardar o teor de referência.
--
-- A commodity é da EMPRESA, como cliente e fornecedor: o mesmo minério é
-- vendido em vários projetos.
--
--   commodities            — o produto, e onde se olha o preço dele.
--   commodity_parametros   — o que define a qualidade: Fe, umidade, sílica…
--                            com o teor de referência do índice e QUANTO O
--                            PREÇO MUDA por ponto fora dele. É esse número que
--                            a etapa 4 usa para ajustar o preço pela pureza.
--
-- Blocos curtos e etiqueta própria — o SQL Editor já truncou duas migrations.
-- Idempotente. Depende de 0007 (organizacoes) e 0014 (padrão de RLS por empresa).

-- ---------------------------------------------------------------------------
-- BLOCO 1 — a commodity
-- ---------------------------------------------------------------------------
create table if not exists public.commodities (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  nome           text not null check (char_length(trim(nome)) between 1 and 160),
  -- Texto livre de propósito: "Minério", "Grão", "Óleo" — nada aqui pode
  -- amarrar o sistema a um setor.
  categoria      text check (categoria is null or char_length(categoria) <= 80),
  unidade_padrao text not null default 'Toneladas' check (char_length(trim(unidade_padrao)) between 1 and 40),
  -- Onde se olha o preço: "SGX TSI 62% Fe", "CBOT Soybeans", "LME Copper".
  -- Por enquanto é referência escrita; a cotação automática vem na etapa 4.
  bolsa          text check (bolsa is null or char_length(bolsa) <= 160),
  observacoes    text check (observacoes is null or char_length(observacoes) <= 2000),
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create unique index if not exists commodities_nome_uq
  on public.commodities (organizacao_id, lower(trim(nome)));

-- ---------------------------------------------------------------------------
-- BLOCO 2 — os parâmetros de qualidade
-- ---------------------------------------------------------------------------
create table if not exists public.commodity_parametros (
  id            uuid primary key default gen_random_uuid(),
  commodity_id  uuid not null references public.commodities (id) on delete cascade,
  nome          text not null check (char_length(trim(nome)) between 1 and 80),
  unidade       text not null default '%' check (char_length(trim(unidade)) between 1 and 20),
  -- O teor que o índice de mercado assume (62 no "62% Fe").
  referencia    numeric(12,4),
  minimo        numeric(12,4),
  maximo        numeric(12,4),
  -- Quanto o preço muda por PONTO fora da referência, na moeda da venda.
  -- Positivo para o que valoriza (Fe); negativo para o que penaliza (sílica,
  -- umidade). É a ponte entre qualidade e preço.
  ajuste_por_ponto numeric(14,4) not null default 0,
  ordem         int not null default 0,
  criado_em     timestamptz not null default now()
);

create index if not exists commodity_parametros_idx
  on public.commodity_parametros (commodity_id, ordem);

-- Faixa invertida é erro de digitação, não uma regra de negócio exótica.
alter table public.commodity_parametros drop constraint if exists commodity_parametros_faixa_ck;

alter table public.commodity_parametros add constraint commodity_parametros_faixa_ck
  check (minimo is null or maximo is null or minimo <= maximo);

-- ---------------------------------------------------------------------------
-- BLOCO 3 — acesso
-- ---------------------------------------------------------------------------
alter table public.commodities enable row level security;

alter table public.commodity_parametros enable row level security;

drop policy if exists commodities_empresa on public.commodities;

create policy commodities_empresa on public.commodities
  for all to authenticated
  using (public.eh_admin_organizacao(organizacao_id))
  with check (public.eh_admin_organizacao(organizacao_id));

/** Empresa dona da commodity — evita repetir a subconsulta na policy dos parâmetros. */
create or replace function public.organizacao_da_commodity(p_commodity_id uuid)
returns uuid language sql stable security definer set search_path = public as $org$
  select organizacao_id from public.commodities where id = p_commodity_id;
$org$;

drop policy if exists commodity_parametros_empresa on public.commodity_parametros;

create policy commodity_parametros_empresa on public.commodity_parametros
  for all to authenticated
  using (public.eh_admin_organizacao(public.organizacao_da_commodity(commodity_id)))
  with check (public.eh_admin_organizacao(public.organizacao_da_commodity(commodity_id)));

grant select, insert, update, delete on public.commodities to authenticated;

grant select, insert, update, delete on public.commodity_parametros to authenticated;

grant execute on function public.organizacao_da_commodity(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- BLOCO 4 — histórico
-- ---------------------------------------------------------------------------
drop trigger if exists historico_commodities on public.commodities;

create trigger historico_commodities
  after insert or update or delete on public.commodities
  for each row execute function public.tg_historico();
