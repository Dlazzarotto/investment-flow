-- 0031 — Pesquisa de mercado (agente de preços) e a tabela de commodities do painel
--
-- 1. pesquisas_mercado: cada pesquisa que o agente "Pesquisador de Commodities"
--    (Claude Managed Agents) faz para uma commodity da empresa. O sistema abre a
--    sessão do agente, guarda o id dela aqui e, quando o agente termina, grava a
--    resposta e a referência principal que ele devolve em JSON (preço, base,
--    unidade, data, fonte). É o histórico de preços da commodity: o painel compara
--    a última pesquisa com a anterior. No modo "bolsas" (painel), a mesma sessão traz
--    o preço nas três praças — Xangai, Londres e Chicago — em `cotacoes`, cada uma
--    com a bolsa e o contrato usados; praça onde o produto não é negociado fica
--    marcada como tal, nunca com zero.
--    - Da empresa, por chave composta; só a administração da empresa lê e grava
--      (investidor e master não chegam). Gravar exige empresa em dia.
--    - Preço desconhecido fica NULL, nunca zero.
-- 2. painel_commodities: as até 3 commodities que CADA usuário escolheu para a
--    tabela do painel. É preferência de quem olha, não da empresa.
--
-- Sem PL/pgSQL. Idempotente. Teste: tests/schema21.test.sql.

-- ---------------------------------------------------------------------------
-- BLOCO 1 — pesquisas de mercado
-- ---------------------------------------------------------------------------
do $sp$ begin
  create type public.status_pesquisa as enum ('pesquisando', 'concluida', 'falhou');
exception when duplicate_object then null; end $sp$;

create table if not exists public.pesquisas_mercado (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  commodity_id   uuid not null,
  grade_id       uuid,
  base           text check (base is null or char_length(base) <= 160),
  pergunta       text not null check (char_length(pergunta) between 1 and 2000),
  idioma         text not null default 'pt' check (idioma in ('pt', 'en', 'es', 'zh')),
  sessao_id      text unique check (sessao_id is null or char_length(sessao_id) between 5 and 120),
  status         public.status_pesquisa not null default 'pesquisando',
  resposta       text check (resposta is null or char_length(resposta) <= 40000),
  erro           text check (erro is null or char_length(erro) <= 1000),
  -- Referência principal, lida do JSON do agente.
  preco          numeric(18,4) check (preco is null or preco >= 0),
  moeda          text check (moeda is null or moeda ~ '^[A-Z]{3}$'),
  unidade        text check (unidade is null or char_length(unidade) <= 40),
  base_cotacao   text check (base_cotacao is null or char_length(base_cotacao) <= 160),
  especificacao  text check (especificacao is null or char_length(especificacao) <= 300),
  data_cotacao   date,
  tipo           text check (tipo is null or tipo in ('spot', 'indice', 'futuro', 'oferta')),
  fonte          text check (fonte is null or char_length(fonte) <= 300),
  url            text check (url is null or char_length(url) <= 1000),
  aproximacao    boolean,
  -- "livre" = pesquisa da aba Commodities (uma referência); "bolsas" = a do painel:
  -- o preço em Xangai, Londres e Chicago, uma cotação por praça em `cotacoes`.
  modo           text not null default 'livre' check (modo in ('livre', 'bolsas')),
  cotacoes       jsonb not null default '[]'::jsonb check (jsonb_typeof(cotacoes) = 'array'),
  custo_usd      numeric(10,2),
  criado_por     uuid default auth.uid(),
  criado_em      timestamptz not null default now(),
  concluida_em   timestamptz,
  constraint pesquisas_mercado_commodity_fk foreign key (commodity_id, organizacao_id)
    references public.commodities (id, organizacao_id) on delete cascade,
  constraint pesquisas_mercado_grade_fk foreign key (grade_id, commodity_id)
    references public.commodity_grades (id, commodity_id) on delete set null (grade_id),
  constraint pesquisas_mercado_fim_ck check (status = 'pesquisando' or concluida_em is not null)
);

create index if not exists pesquisas_mercado_commodity_idx
  on public.pesquisas_mercado (organizacao_id, commodity_id, criado_em desc);

alter table public.pesquisas_mercado enable row level security;

drop policy if exists pesquisas_mercado_ver on public.pesquisas_mercado;

create policy pesquisas_mercado_ver on public.pesquisas_mercado for select to authenticated
  using (public.eh_admin_organizacao(organizacao_id));

drop policy if exists pesquisas_mercado_escrever on public.pesquisas_mercado;

create policy pesquisas_mercado_escrever on public.pesquisas_mercado for all to authenticated
  using (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id))
  with check (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id));

grant select, insert, update, delete on public.pesquisas_mercado to authenticated;

-- ---------------------------------------------------------------------------
-- BLOCO 2 — as 3 commodities do painel, por usuário
-- ---------------------------------------------------------------------------
create table if not exists public.painel_commodities (
  usuario_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  commodity_ids  uuid[] not null default '{}' check (cardinality(commodity_ids) <= 3),
  atualizado_em  timestamptz not null default now()
);

alter table public.painel_commodities enable row level security;

drop policy if exists painel_commodities_proprio on public.painel_commodities;

create policy painel_commodities_proprio on public.painel_commodities for all to authenticated
  using (usuario_id = auth.uid() and public.eh_admin_organizacao(organizacao_id))
  with check (usuario_id = auth.uid() and public.eh_admin_organizacao(organizacao_id));

grant select, insert, update, delete on public.painel_commodities to authenticated;

-- ---------------------------------------------------------------------------
-- BLOCO 3 — conferência: tem que voltar true nas duas colunas.
-- ---------------------------------------------------------------------------
select to_regclass('public.pesquisas_mercado') is not null as pesquisas_mercado,
       to_regclass('public.painel_commodities') is not null as painel_commodities;
