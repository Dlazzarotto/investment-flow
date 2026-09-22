-- ============================================================================
-- 0005_custos_e_despesas.sql — O que sai por causa da venda e o custeio do projeto
--
-- Até aqui a venda guardava só a receita bruta (volume × preço). O resultado do
-- projeto era receita − investimento, então frete, imposto, comissão e o custo da
-- mercadoria só entravam se fossem lançados à mão como "investimento operacional".
--
-- Esta migration separa as três coisas:
--   1. investimentos  → capital aportado (Capex/Opex de aporte), como já era
--   2. vendas         → ganham custo DIRETO daquele embarque (4 componentes)
--   3. despesas       → custeio do projeto que não se liga a uma venda
--
-- E fluxo_mensal() passa a devolver tudo isso, com saida = investimento +
-- custo de vendas + despesas. Saldo, break-even, ROI, TIR e cenários passam a
-- olhar para "saida" no lugar de só "investimento".
--
-- Executar depois de 0004. Idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Custo direto da venda
--
-- Dois componentes escalam com o volume (mercadoria e frete) e dois são
-- percentuais sobre a receita (impostos/royalties e comissão) — é assim que
-- aparecem num contrato de minério ou de frete.
--
-- custo_total é coluna gerada, como valor_total e receita_total. O Postgres não
-- deixa uma coluna gerada referenciar outra, então a conta aparece inteira aqui;
-- a quebra por componente é calculada na aplicação (lib/calculos.ts).
-- ---------------------------------------------------------------------------
alter table public.vendas
  add column if not exists custo_unitario numeric(16,2) not null default 0 check (custo_unitario >= 0),
  add column if not exists frete_unitario numeric(16,2) not null default 0 check (frete_unitario >= 0),
  add column if not exists impostos_pct   numeric(5,2)  not null default 0 check (impostos_pct between 0 and 100),
  add column if not exists comissao_pct   numeric(5,2)  not null default 0 check (comissao_pct between 0 and 100);

alter table public.vendas
  add column if not exists custo_total numeric(18,2)
    generated always as (
      round(volume * custo_unitario
          + volume * frete_unitario
          + volume * preco_unitario * (impostos_pct + comissao_pct) / 100, 2)
    ) stored;

comment on column public.vendas.custo_total is
  'Custo direto da venda: mercadoria + frete + (impostos + comissão) sobre a receita.';

-- ---------------------------------------------------------------------------
-- 2. Despesas do projeto
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.categoria_despesa as enum
    ('pessoal', 'manutencao', 'combustivel', 'arrendamento', 'administrativo', 'impostos', 'outros');
exception when duplicate_object then null; end $$;

create table if not exists public.despesas (
  id         uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  descricao  text not null check (char_length(trim(descricao)) between 1 and 160),
  categoria  public.categoria_despesa not null,
  valor      numeric(16,2) not null check (valor > 0),
  data       date not null,
  criado_em  timestamptz not null default now()
);
create index if not exists despesas_projeto_data_idx on public.despesas (projeto_id, data);

alter table public.despesas enable row level security;

drop policy if exists despesas_ver on public.despesas;
create policy despesas_ver on public.despesas
  for select to authenticated
  using (public.pode_ver_projeto(projeto_id));

drop policy if exists despesas_escrever on public.despesas;
create policy despesas_escrever on public.despesas
  for all to authenticated
  using (public.pode_editar_projeto(projeto_id))
  with check (public.pode_editar_projeto(projeto_id));

grant select, insert, update, delete on public.despesas to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Fluxo mensal com as três saídas
--
-- O tipo de retorno mudou, então a função precisa ser derrubada antes de recriada.
-- ---------------------------------------------------------------------------
drop function if exists public.fluxo_mensal(uuid);

create function public.fluxo_mensal(p_projeto_id uuid)
returns table (
  mes             date,
  investimento    numeric,
  custo_vendas    numeric,
  despesas        numeric,
  saida           numeric,
  receita         numeric,
  saida_acumulada numeric,
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
        union all
        select date_trunc('month', data)::date       from public.despesas      where projeto_id = p_projeto_id
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
  ven as (
    select date_trunc('month', data)::date as mes, sum(receita_total) as r, sum(custo_total) as c
      from public.vendas where projeto_id = p_projeto_id group by 1
  ),
  des as (
    select date_trunc('month', data)::date as mes, sum(valor) as v
      from public.despesas where projeto_id = p_projeto_id group by 1
  ),
  base as (
    select m.mes,
           coalesce(i.v, 0)::numeric as investimento,
           coalesce(v.c, 0)::numeric as custo_vendas,
           coalesce(d.v, 0)::numeric as despesas,
           coalesce(v.r, 0)::numeric as receita
      from meses m
      left join inv i on i.mes = m.mes
      left join ven v on v.mes = m.mes
      left join des d on d.mes = m.mes
  ),
  somado as (
    select mes, investimento, custo_vendas, despesas, receita,
           investimento + custo_vendas + despesas as saida
      from base
  )
  select mes,
         investimento,
         custo_vendas,
         despesas,
         saida,
         receita,
         sum(saida)   over (order by mes) as saida_acumulada,
         sum(receita) over (order by mes) as rec_acumulada,
         sum(receita) over (order by mes) - sum(saida) over (order by mes) as saldo_acumulado
    from somado
   order by mes;
$$;

grant execute on function public.fluxo_mensal(uuid) to authenticated;
