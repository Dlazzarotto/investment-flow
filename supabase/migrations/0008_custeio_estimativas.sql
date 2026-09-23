-- ============================================================================
-- 0008_custeio_estimativas.sql — Motor de custeio: do custo para o preço
--
-- O sistema sabia dizer a margem DEPOIS da venda. Isto é o contrário: você monta
-- a estrutura de custo e ele devolve o preço que faz a margem existir.
--
-- Duas tabelas:
--   estimativas_custo  — o cabeçalho: commodity, modo (produção própria ou
--                        revenda), volume do lote, produção diária e margem alvo
--   estimativa_itens   — cada linha de custo, com um DRIVER que diz como aquele
--                        valor vira custo por unidade de produto
--
-- Drivers (v = valor × quantidade):
--   por_unidade   v já é por tonelada
--   por_dia       v / produção diária
--   por_mes       v / (produção diária × dias no mês)
--   por_lote      v / volume total do lote
--   pct_custo     % sobre a soma dos itens absolutos (ex.: administrativo)
--   pct_receita   % sobre a receita (impostos, royalties, comissão)
--
-- O cálculo em si fica em lib/custeio.ts, com teste: é conta pura, e o Postgres
-- não é o lugar de uma equação que a tela precisa recalcular a cada tecla.
-- Acesso: investidor não vê (é precificação interna); manager vê e edita;
-- escritório vê; alterar é de quem já pode alterar (dono, admin, manager).
--
-- Executar depois de 0007. Idempotente.
-- ============================================================================

do $$ begin
  create type public.modo_estimativa as enum ('producao_propria', 'revenda');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.grupo_custo as enum
    ('producao', 'pessoal', 'logistica_interna', 'porto', 'frete', 'tributos', 'administrativo', 'outros');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.driver_custo as enum
    ('por_unidade', 'por_dia', 'por_mes', 'por_lote', 'pct_custo', 'pct_receita');
exception when duplicate_object then null; end $$;

create table if not exists public.estimativas_custo (
  id              uuid primary key default gen_random_uuid(),
  projeto_id      uuid not null references public.projetos (id) on delete cascade,
  nome            text not null check (char_length(trim(nome)) between 1 and 160),
  commodity       text not null check (char_length(trim(commodity)) between 1 and 120),
  modo            public.modo_estimativa not null default 'producao_propria',
  moeda           public.moeda not null,
  unidade         text not null default 'Toneladas' check (char_length(trim(unidade)) between 1 and 40),
  -- Volume do lote que a estimativa precifica; divide os custos lançados como "por lote".
  volume_total    numeric(14,3) not null check (volume_total > 0),
  -- Produção diária; divide os custos de pessoal e de operação. Zero = revenda.
  producao_diaria numeric(14,3) not null default 0 check (producao_diaria >= 0),
  dias_mes        int not null default 30 check (dias_mes between 1 and 31),
  -- Margem alvo: 100 % seria preço infinito, por isso o limite aberto.
  margem_alvo_pct numeric(5,2) not null default 0 check (margem_alvo_pct >= 0 and margem_alvo_pct < 100),
  observacoes     text check (observacoes is null or char_length(observacoes) <= 2000),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index if not exists estimativas_custo_projeto_idx on public.estimativas_custo (projeto_id, criado_em desc);

drop trigger if exists estimativas_custo_atualizado_em on public.estimativas_custo;
create trigger estimativas_custo_atualizado_em
  before update on public.estimativas_custo
  for each row execute function public.tg_set_atualizado_em();

create table if not exists public.estimativa_itens (
  id            uuid primary key default gen_random_uuid(),
  estimativa_id uuid not null references public.estimativas_custo (id) on delete cascade,
  grupo         public.grupo_custo not null,
  nome          text not null check (char_length(trim(nome)) between 1 and 160),
  driver        public.driver_custo not null,
  valor         numeric(16,4) not null check (valor >= 0),
  quantidade    numeric(14,3) not null default 1 check (quantidade > 0),
  -- 'ia' marca o que veio sugerido pelo modelo e ainda não foi confirmado por gente.
  origem        text not null default 'manual' check (origem in ('manual', 'ia')),
  fonte         text check (fonte is null or char_length(fonte) <= 500),
  ordem         int not null default 0,
  criado_em     timestamptz not null default now()
);
create index if not exists estimativa_itens_estimativa_idx on public.estimativa_itens (estimativa_id, grupo, ordem);

-- Percentual é percentual: não faz sentido passar de 100.
alter table public.estimativa_itens drop constraint if exists estimativa_itens_pct_ck;
alter table public.estimativa_itens add constraint estimativa_itens_pct_ck
  check (driver not in ('pct_custo', 'pct_receita') or valor <= 100);

-- ---------------------------------------------------------------------------
-- Acesso
-- ---------------------------------------------------------------------------
alter table public.estimativas_custo enable row level security;
alter table public.estimativa_itens  enable row level security;

/** Vê o custeio: qualquer papel do projeto, menos o investidor (é preço interno). */
create or replace function public.pode_ver_custeio(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_ver_projeto(p_projeto_id) and not public.eh_investidor(p_projeto_id);
$$;

drop policy if exists estimativas_custo_ver on public.estimativas_custo;
create policy estimativas_custo_ver on public.estimativas_custo
  for select to authenticated using (public.pode_ver_custeio(projeto_id));

drop policy if exists estimativas_custo_escrever on public.estimativas_custo;
create policy estimativas_custo_escrever on public.estimativas_custo
  for all to authenticated
  using (public.pode_alterar(projeto_id))
  with check (public.pode_alterar(projeto_id));

/** Projeto dono da estimativa — evita repetir a subconsulta nas policies dos itens. */
create or replace function public.projeto_da_estimativa(p_estimativa_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select projeto_id from public.estimativas_custo where id = p_estimativa_id;
$$;

drop policy if exists estimativa_itens_ver on public.estimativa_itens;
create policy estimativa_itens_ver on public.estimativa_itens
  for select to authenticated
  using (public.pode_ver_custeio(public.projeto_da_estimativa(estimativa_id)));

drop policy if exists estimativa_itens_escrever on public.estimativa_itens;
create policy estimativa_itens_escrever on public.estimativa_itens
  for all to authenticated
  using (public.pode_alterar(public.projeto_da_estimativa(estimativa_id)))
  with check (public.pode_alterar(public.projeto_da_estimativa(estimativa_id)));

grant select, insert, update, delete on public.estimativas_custo, public.estimativa_itens to authenticated;
grant execute on function public.pode_ver_custeio(uuid) to authenticated;
grant execute on function public.projeto_da_estimativa(uuid) to authenticated;
