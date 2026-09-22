-- ============================================================================
-- 0002_estimativas_ia.sql — Estimativas de valor médio de mercado por item (IA)
-- Executar depois de 0001_schema.sql. Idempotente.
-- ============================================================================

create table if not exists public.estimativas_ia (
  id               uuid primary key default gen_random_uuid(),
  projeto_id       uuid not null references public.projetos (id) on delete cascade,
  item             text not null check (char_length(trim(item)) between 1 and 160),
  item_normalizado text generated always as (lower(trim(item))) stored,
  contexto         text,
  moeda            public.moeda not null,
  unidade_ref      text not null default 'unidade',
  valor_min        numeric(16,2) not null check (valor_min >= 0),
  valor_medio      numeric(16,2) not null check (valor_medio >= 0),
  valor_max        numeric(16,2) not null check (valor_max >= 0),
  confianca        text not null default 'media' check (confianca in ('baixa', 'media', 'alta')),
  premissas        text[] not null default '{}',
  fontes           jsonb not null default '[]'::jsonb,
  modelo           text not null,
  criado_em        timestamptz not null default now(),
  constraint estimativas_ia_faixa_ck check (valor_min <= valor_medio and valor_medio <= valor_max)
);

create index if not exists estimativas_ia_projeto_item_idx
  on public.estimativas_ia (projeto_id, item_normalizado, criado_em desc);

alter table public.estimativas_ia enable row level security;

drop policy if exists estimativas_ia_owner on public.estimativas_ia;
create policy estimativas_ia_owner on public.estimativas_ia
  for all to authenticated
  using (exists (select 1 from public.projetos p where p.id = projeto_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projetos p where p.id = projeto_id and p.owner_id = auth.uid()));

grant select, insert, update, delete on public.estimativas_ia to authenticated;

-- Última estimativa de cada item do projeto (usada na tabela de investimentos e na exportação)
create or replace function public.ultimas_estimativas(p_projeto_id uuid)
returns setof public.estimativas_ia
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (item_normalizado) *
    from public.estimativas_ia
   where projeto_id = p_projeto_id
   order by item_normalizado, criado_em desc;
$$;

grant execute on function public.ultimas_estimativas(uuid) to authenticated;
