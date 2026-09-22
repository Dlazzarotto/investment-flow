-- ============================================================================
-- 0004_projeto_membros.sql — Acesso de sócios ao projeto
--
-- Até aqui só o dono (projetos.owner_id) enxergava qualquer coisa. Esta migration
-- cria projeto_membros: o dono libera o acesso por e-mail e escolhe o papel.
--
--   leitor  → vê tudo do projeto, não altera nada
--   editor  → também lança/edita/exclui investimentos, vendas e participantes
--   dono    → não é papel de membro; é quem criou o projeto. Só ele mexe na
--             estrutura da parceria, na lista de membros e na exclusão do projeto.
--
-- IMPORTANTE (segurança): o vínculo é pelo e-mail CONFIRMADO da conta. Se
-- "Confirm email" estiver desligado no Supabase (Authentication → Providers →
-- Email), qualquer pessoa poderia se cadastrar com o e-mail do sócio e entrar no
-- projeto — por isso o acesso de membro só vale com e-mail confirmado. Ligue a
-- confirmação antes de convidar alguém.
--
-- Executar depois de 0003. Idempotente.
-- ============================================================================

do $$ begin
  create type public.papel_membro as enum ('leitor', 'editor');
exception when duplicate_object then null; end $$;

create table if not exists public.projeto_membros (
  id                uuid primary key default gen_random_uuid(),
  projeto_id        uuid not null references public.projetos (id) on delete cascade,
  email             text not null check (char_length(trim(email)) between 3 and 320 and position('@' in email) > 1),
  email_normalizado text generated always as (lower(trim(email))) stored,
  papel             public.papel_membro not null default 'leitor',
  criado_em         timestamptz not null default now()
);

create unique index if not exists projeto_membros_projeto_email_uq
  on public.projeto_membros (projeto_id, email_normalizado);
create index if not exists projeto_membros_email_idx
  on public.projeto_membros (email_normalizado);

-- ---------------------------------------------------------------------------
-- Funções de permissão
--
-- SECURITY DEFINER de propósito: as policies de projetos consultam projeto_membros
-- e vice-versa; sem isso o Postgres entra em recursão de RLS. Rodando como dona da
-- função, a consulta interna ignora RLS — e nenhuma delas devolve dado, só boolean.
-- ---------------------------------------------------------------------------

/** E-mail confirmado do usuário logado; null se a conta não confirmou o e-mail. */
create or replace function public.email_confirmado()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(trim(u.email))
    from auth.users u
   where u.id = auth.uid()
     and u.email_confirmed_at is not null;
$$;

/** Dono, editor ou leitor do projeto. */
create or replace function public.pode_ver_projeto(p_projeto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
      select 1 from public.projetos p
       where p.id = p_projeto_id and p.owner_id = auth.uid())
      or exists (
      select 1 from public.projeto_membros m
       where m.projeto_id = p_projeto_id
         and m.email_normalizado = public.email_confirmado());
$$;

/** Dono ou membro com papel 'editor' — quem pode lançar e alterar movimentações. */
create or replace function public.pode_editar_projeto(p_projeto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
      select 1 from public.projetos p
       where p.id = p_projeto_id and p.owner_id = auth.uid())
      or exists (
      select 1 from public.projeto_membros m
       where m.projeto_id = p_projeto_id
         and m.papel = 'editor'
         and m.email_normalizado = public.email_confirmado());
$$;

/** Papel do usuário logado no projeto: 'dono', 'editor', 'leitor' ou null. */
create or replace function public.papel_no_projeto(p_projeto_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.projetos p where p.id = p_projeto_id and p.owner_id = auth.uid()) then 'dono'
    else (select m.papel::text from public.projeto_membros m
           where m.projeto_id = p_projeto_id
             and m.email_normalizado = public.email_confirmado()
           limit 1)
  end;
$$;

-- ---------------------------------------------------------------------------
-- A trava de 100 % passa a rodar como dona da função
--
-- fn_validar_participacao trava a linha do projeto com "select ... for update", e
-- o Postgres exige a policy de UPDATE para bloquear linha. Um editor não tem
-- UPDATE em projetos (só o dono tem), então a trava seria PULADA em silêncio
-- quando um editor cadastrasse participante. SECURITY DEFINER resolve: a função
-- valida sempre, para qualquer membro, e continua não devolvendo dado nenhum.
-- ---------------------------------------------------------------------------
create or replace function public.fn_validar_participacao(p_projeto_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dono  numeric;
  v_total numeric;
begin
  select p.participacao_pct
    into v_dono
    from public.projetos p
   where p.id = p_projeto_id
     for update;

  if not found then
    return;
  end if;

  select v_dono + coalesce(sum(pp.percentual), 0)
    into v_total
    from public.participantes pp
   where pp.projeto_id = p_projeto_id;

  if v_total > 100 then
    raise exception 'A soma das participações do projeto ultrapassa 100%% (total: % %%).', round(v_total, 2)
      using errcode = 'check_violation';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Policies: leitura para quem vê o projeto, escrita para quem pode editar
-- ---------------------------------------------------------------------------
alter table public.projeto_membros enable row level security;

-- projetos: ver = dono ou membro; alterar/excluir = só o dono
drop policy if exists projetos_owner on public.projetos;
drop policy if exists projetos_ver on public.projetos;
create policy projetos_ver on public.projetos
  for select to authenticated
  using (public.pode_ver_projeto(id));

drop policy if exists projetos_criar on public.projetos;
create policy projetos_criar on public.projetos
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists projetos_alterar on public.projetos;
create policy projetos_alterar on public.projetos
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists projetos_excluir on public.projetos;
create policy projetos_excluir on public.projetos
  for delete to authenticated
  using (owner_id = auth.uid());

-- movimentações e cadastro: leitura para membros, escrita para editores
do $$
declare
  t text;
begin
  foreach t in array array['participantes', 'investimentos', 'vendas', 'estimativas_ia'] loop
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format('drop policy if exists %I on public.%I', t || '_ver', t);
    execute format('drop policy if exists %I on public.%I', t || '_escrever', t);

    execute format($f$
      create policy %I on public.%I
        for select to authenticated
        using (public.pode_ver_projeto(projeto_id))
    $f$, t || '_ver', t);

    execute format($f$
      create policy %I on public.%I
        for all to authenticated
        using (public.pode_editar_projeto(projeto_id))
        with check (public.pode_editar_projeto(projeto_id))
    $f$, t || '_escrever', t);
  end loop;
end $$;

-- membros: todo mundo do projeto vê a lista (transparência na parceria);
-- só o dono convida e remove.
drop policy if exists projeto_membros_ver on public.projeto_membros;
create policy projeto_membros_ver on public.projeto_membros
  for select to authenticated
  using (public.pode_ver_projeto(projeto_id));

drop policy if exists projeto_membros_gerir on public.projeto_membros;
create policy projeto_membros_gerir on public.projeto_membros
  for all to authenticated
  using (exists (select 1 from public.projetos p where p.id = projeto_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projetos p where p.id = projeto_id and p.owner_id = auth.uid()));

grant select, insert, update, delete on public.projeto_membros to authenticated;
grant execute on function public.email_confirmado() to authenticated;
grant execute on function public.pode_ver_projeto(uuid) to authenticated;
grant execute on function public.pode_editar_projeto(uuid) to authenticated;
grant execute on function public.papel_no_projeto(uuid) to authenticated;
