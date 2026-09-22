-- ============================================================================
-- 0001_schema.sql — Investment Dashboard (Supabase / Postgres)
-- Gestão de aportes, receitas e parcerias por projeto.
-- Idempotente: pode ser executado mais de uma vez.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Tipos enumerados (espelhados em lib/types.ts e lib/labels.ts)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.moeda as enum ('USD', 'BRL', 'EUR', 'GBP');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_parceria as enum ('sociedade_direta', 'joint_venture', 'investidor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_participante as enum ('socio', 'parceiro_jv', 'investidor', 'operador');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.categoria_investimento as enum ('infraestrutura', 'logistica', 'operacional');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.categoria_receita as enum ('venda_produto', 'frete_logistica', 'servicos', 'outros');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Tabelas
-- ---------------------------------------------------------------------------
create table if not exists public.projetos (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome             text not null check (char_length(trim(nome)) between 1 and 120),
  descricao        text,
  data_inicio      date not null,
  moeda            public.moeda not null default 'USD',
  tipo_parceria    public.tipo_parceria not null default 'sociedade_direta',
  participacao_pct numeric(5,2) not null default 100
                   check (participacao_pct >= 0 and participacao_pct <= 100),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create unique index if not exists projetos_owner_nome_uq
  on public.projetos (owner_id, lower(trim(nome)));

create table if not exists public.participantes (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid not null references public.projetos (id) on delete cascade,
  nome        text not null check (char_length(trim(nome)) between 1 and 120),
  tipo        public.tipo_participante not null,
  percentual  numeric(5,2) not null check (percentual > 0 and percentual <= 100),
  contato     text,
  criado_em   timestamptz not null default now()
);
create index if not exists participantes_projeto_idx on public.participantes (projeto_id);

create table if not exists public.investimentos (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references public.projetos (id) on delete cascade,
  item           text not null check (char_length(trim(item)) between 1 and 160),
  categoria      public.categoria_investimento not null,
  quantidade     numeric(14,3) not null check (quantidade > 0),
  valor_unitario numeric(16,2) not null check (valor_unitario > 0),
  valor_total    numeric(18,2) generated always as (round(quantidade * valor_unitario, 2)) stored,
  data           date not null,
  criado_em      timestamptz not null default now()
);
create index if not exists investimentos_projeto_data_idx on public.investimentos (projeto_id, data);

create table if not exists public.vendas (
  id             uuid primary key default gen_random_uuid(),
  projeto_id     uuid not null references public.projetos (id) on delete cascade,
  categoria      public.categoria_receita not null,
  volume         numeric(14,3) not null check (volume > 0),
  unidade        text not null check (char_length(trim(unidade)) between 1 and 40),
  preco_unitario numeric(16,2) not null check (preco_unitario > 0),
  receita_total  numeric(18,2) generated always as (round(volume * preco_unitario, 2)) stored,
  data           date not null,
  criado_em      timestamptz not null default now()
);
create index if not exists vendas_projeto_data_idx on public.vendas (projeto_id, data);

-- ---------------------------------------------------------------------------
-- 3. Triggers
-- ---------------------------------------------------------------------------
create or replace function public.tg_set_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists projetos_atualizado_em on public.projetos;
create trigger projetos_atualizado_em
  before update on public.projetos
  for each row execute function public.tg_set_atualizado_em();

-- Trava: participação do dono + soma dos participantes nunca ultrapassa 100 %.
create or replace function public.fn_validar_participacao(p_projeto_id uuid)
returns void language plpgsql as $$
declare
  v_total numeric;
begin
  select p.participacao_pct + coalesce((select sum(pp.percentual)
                                          from public.participantes pp
                                         where pp.projeto_id = p.id), 0)
    into v_total
    from public.projetos p
   where p.id = p_projeto_id;

  if v_total > 100 then
    raise exception 'A soma das participações do projeto ultrapassa 100%% (total: % %%).', round(v_total, 2)
      using errcode = 'check_violation';
  end if;
end $$;

create or replace function public.tg_participantes_validar()
returns trigger language plpgsql as $$
begin
  perform public.fn_validar_participacao(coalesce(new.projeto_id, old.projeto_id));
  return coalesce(new, old);
end $$;

drop trigger if exists participantes_validar on public.participantes;
create trigger participantes_validar
  after insert or update on public.participantes
  for each row execute function public.tg_participantes_validar();

create or replace function public.tg_projetos_validar()
returns trigger language plpgsql as $$
begin
  perform public.fn_validar_participacao(new.id);
  return new;
end $$;

drop trigger if exists projetos_validar on public.projetos;
create trigger projetos_validar
  after update of participacao_pct on public.projetos
  for each row execute function public.tg_projetos_validar();

-- ---------------------------------------------------------------------------
-- 4. Função: fluxo mensal contínuo (meses sem lançamento entram com zero)
-- ---------------------------------------------------------------------------
create or replace function public.fluxo_mensal(p_projeto_id uuid)
returns table (
  mes             date,
  investimento    numeric,
  receita         numeric,
  inv_acumulado   numeric,
  rec_acumulada   numeric,
  saldo_acumulado numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with limites as (
    select min(d) as ini, max(d) as fim
      from (
        select date_trunc('month', data)::date as d from public.investimentos where projeto_id = p_projeto_id
        union all
        select date_trunc('month', data)::date       from public.vendas        where projeto_id = p_projeto_id
      ) t
  ),
  meses as (
    select generate_series(ini, fim, interval '1 month')::date as mes
      from limites
     where ini is not null
  ),
  inv as (
    select date_trunc('month', data)::date as mes, sum(valor_total) as v
      from public.investimentos where projeto_id = p_projeto_id group by 1
  ),
  rec as (
    select date_trunc('month', data)::date as mes, sum(receita_total) as v
      from public.vendas where projeto_id = p_projeto_id group by 1
  ),
  base as (
    select m.mes,
           coalesce(i.v, 0)::numeric as investimento,
           coalesce(r.v, 0)::numeric as receita
      from meses m
      left join inv i on i.mes = m.mes
      left join rec r on r.mes = m.mes
  )
  select mes,
         investimento,
         receita,
         sum(investimento) over (order by mes) as inv_acumulado,
         sum(receita)      over (order by mes) as rec_acumulada,
         sum(receita)      over (order by mes) - sum(investimento) over (order by mes) as saldo_acumulado
    from base
   order by mes;
$$;

-- ---------------------------------------------------------------------------
-- 5. Row Level Security — cada usuário só enxerga os próprios projetos
-- ---------------------------------------------------------------------------
alter table public.projetos      enable row level security;
alter table public.participantes enable row level security;
alter table public.investimentos enable row level security;
alter table public.vendas        enable row level security;

drop policy if exists projetos_owner on public.projetos;
create policy projetos_owner on public.projetos
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists participantes_owner on public.participantes;
create policy participantes_owner on public.participantes
  for all to authenticated
  using (exists (select 1 from public.projetos p where p.id = projeto_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projetos p where p.id = projeto_id and p.owner_id = auth.uid()));

drop policy if exists investimentos_owner on public.investimentos;
create policy investimentos_owner on public.investimentos
  for all to authenticated
  using (exists (select 1 from public.projetos p where p.id = projeto_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projetos p where p.id = projeto_id and p.owner_id = auth.uid()));

drop policy if exists vendas_owner on public.vendas;
create policy vendas_owner on public.vendas
  for all to authenticated
  using (exists (select 1 from public.projetos p where p.id = projeto_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projetos p where p.id = projeto_id and p.owner_id = auth.uid()));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.projetos, public.participantes,
      public.investimentos, public.vendas to authenticated;
grant execute on function public.fluxo_mensal(uuid) to authenticated;
