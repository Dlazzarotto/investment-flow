-- ============================================================================
-- 0006_papeis_pin_convites.sql — Admin, Manager e Escritório
--
-- Os papéis 'leitor' e 'editor' de 0004 dão lugar a três:
--
--   admin       acesso total: tudo que o dono faz, menos excluir o projeto e
--               remover o próprio dono
--   manager     vê e lança entradas e saídas (vendas, custos, despesas) e
--               corrige o que for preciso — NÃO enxerga investimentos
--   escritorio  só lança; para alterar ou excluir precisa do PIN do projeto
--
-- Papéis antigos são convertidos: editor → admin, leitor → manager. O leitor
-- enxergava investimentos e o manager não, então a conversão só tira acesso.
--
-- PIN: é do PROJETO, cadastrado pelo admin, guardado com bcrypt (pgcrypto) e
-- nunca lido de volta. Não é a senha de login de ninguém — de propósito: pedir a
-- senha da conta de outra pessoa é o caminho mais curto para vazá-la.
-- Autorizar abre uma janela curta (como o sudo), registrada em public.autorizacoes.
--
-- Convites: por e-mail (como em 0004) e por LINK. O link guarda só o sha256 do
-- token, tem validade e número de usos, e pode ser revogado.
--
-- Executar depois de 0005. Idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Papéis
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.papel_projeto as enum ('admin', 'manager', 'escritorio');
exception when duplicate_object then null; end $$;

-- A conversão só roda se a coluna ainda estiver no tipo antigo; sem essa guarda,
-- rodar a migration duas vezes rebaixaria todo admin a escritório.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'projeto_membros'
       and column_name = 'papel' and udt_name = 'papel_membro'
  ) then
    alter table public.projeto_membros alter column papel drop default;
    alter table public.projeto_membros
      alter column papel type public.papel_projeto
      using (case papel::text
               when 'editor' then 'admin'
               when 'leitor' then 'manager'
               else 'escritorio'
             end)::public.papel_projeto;
    alter table public.projeto_membros alter column papel set default 'escritorio';
    drop type if exists public.papel_membro;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. PIN de autorização do projeto
-- ---------------------------------------------------------------------------
create table if not exists public.projeto_pin (
  projeto_id    uuid primary key references public.projetos (id) on delete cascade,
  hash          text not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);
-- Sem policy nenhuma: RLS ligado e nada liberado, então o hash não sai por
-- consulta direta. Quem mexe são as funções security definer abaixo.
alter table public.projeto_pin enable row level security;

/** Registro de cada tentativa de autorização — serve de trilha e de trava. */
create table if not exists public.autorizacoes (
  id         uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sucesso    boolean not null,
  criado_em  timestamptz not null default now(),
  expira_em  timestamptz not null
);
create index if not exists autorizacoes_busca_idx
  on public.autorizacoes (projeto_id, user_id, sucesso, expira_em desc);

alter table public.autorizacoes enable row level security;
drop policy if exists autorizacoes_ver on public.autorizacoes;
create policy autorizacoes_ver on public.autorizacoes
  for select to authenticated
  using (public.pode_ver_projeto(projeto_id));

-- ---------------------------------------------------------------------------
-- 3. Convites por link
-- ---------------------------------------------------------------------------
create table if not exists public.convites (
  id         uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  token_hash text not null unique,
  papel      public.papel_projeto not null default 'escritorio',
  criado_por uuid references auth.users (id) on delete set null,
  criado_em  timestamptz not null default now(),
  expira_em  timestamptz not null,
  usos       int not null default 0 check (usos >= 0),
  max_usos   int not null default 1 check (max_usos between 1 and 50),
  revogado   boolean not null default false
);
create index if not exists convites_projeto_idx on public.convites (projeto_id, criado_em desc);

alter table public.convites enable row level security;
-- A lista de convites é do projeto; o token não está aqui, só o hash.
drop policy if exists convites_ver on public.convites;
create policy convites_ver on public.convites
  for select to authenticated
  using (public.pode_administrar_projeto(projeto_id));

drop policy if exists convites_gerir on public.convites;
create policy convites_gerir on public.convites
  for all to authenticated
  using (public.pode_administrar_projeto(projeto_id))
  with check (public.pode_administrar_projeto(projeto_id));

-- ---------------------------------------------------------------------------
-- 4. Funções de permissão
--
-- Todas security definer pelo mesmo motivo de 0004: as policies de projetos
-- consultam projeto_membros e vice-versa, e sem isso o Postgres entra em
-- recursão de RLS. Nenhuma delas devolve dado — só papel, boolean ou nada.
-- ---------------------------------------------------------------------------
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

/** Qualquer papel enxerga o projeto. */
create or replace function public.pode_ver_projeto(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.papel_no_projeto(p_projeto_id) is not null;
$$;

/** Dono e admin mandam em tudo: membros, parceria, estrutura, PIN. */
create or replace function public.pode_administrar_projeto(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.papel_no_projeto(p_projeto_id) in ('dono', 'admin');
$$;

/** Investimentos são decisão de capital: só dono e admin veem e mexem. */
create or replace function public.pode_ver_investimentos(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.papel_no_projeto(p_projeto_id) in ('dono', 'admin');
$$;

/** Quem pode lançar venda e despesa (inserir). */
create or replace function public.pode_lancar(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.papel_no_projeto(p_projeto_id) in ('dono', 'admin', 'manager', 'escritorio');
$$;

/** Quem altera e exclui sem precisar de PIN. */
create or replace function public.pode_alterar(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.papel_no_projeto(p_projeto_id) in ('dono', 'admin', 'manager');
$$;

-- Mantida por compatibilidade com 0004/0005: "editar" agora é "lançar".
create or replace function public.pode_editar_projeto(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_lancar(p_projeto_id);
$$;

-- ---------------------------------------------------------------------------
-- 5. PIN: cadastrar, autorizar, consultar janela aberta
-- ---------------------------------------------------------------------------
/** Minutos que a autorização continua valendo depois de acertar o PIN. */
create or replace function public.pin_janela_minutos()
returns int language sql immutable as $$ select 3; $$;

/** Cadastra ou troca o PIN do projeto. Só dono e admin; mínimo de 6 caracteres. */
create or replace function public.definir_pin(p_projeto_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.pode_administrar_projeto(p_projeto_id) then
    raise exception 'Sem permissão para definir o PIN deste projeto.' using errcode = '42501';
  end if;
  if p_pin is null or char_length(trim(p_pin)) < 6 then
    raise exception 'O PIN precisa ter ao menos 6 caracteres.' using errcode = 'check_violation';
  end if;

  insert into public.projeto_pin (projeto_id, hash, atualizado_em, atualizado_por)
  values (p_projeto_id, crypt(trim(p_pin), gen_salt('bf')), now(), auth.uid())
  on conflict (projeto_id) do update
    set hash = excluded.hash, atualizado_em = now(), atualizado_por = auth.uid();
end $$;

/** Remove o PIN — o escritório volta a não poder alterar nem excluir. */
create or replace function public.remover_pin(p_projeto_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.pode_administrar_projeto(p_projeto_id) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  delete from public.projeto_pin where projeto_id = p_projeto_id;
end $$;

/** Só diz se existe PIN cadastrado; nunca devolve o hash. */
create or replace function public.tem_pin(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_ver_projeto(p_projeto_id)
     and exists (select 1 from public.projeto_pin where projeto_id = p_projeto_id);
$$;

/**
 * Confere o PIN e, acertando, abre a janela de autorização.
 * Cinco erros nos últimos 15 minutos travam novas tentativas: o bcrypt já é
 * lento, mas sem trava um PIN de 6 dígitos cairia em força bruta.
 */
create or replace function public.autorizar_pin(p_projeto_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash    text;
  v_falhas  int;
  v_ok      boolean;
begin
  if not public.pode_lancar(p_projeto_id) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;

  select count(*) into v_falhas
    from public.autorizacoes
   where projeto_id = p_projeto_id and user_id = auth.uid()
     and not sucesso and criado_em > now() - interval '15 minutes';
  if v_falhas >= 5 then
    raise exception 'Muitas tentativas. Aguarde 15 minutos.' using errcode = 'check_violation';
  end if;

  select hash into v_hash from public.projeto_pin where projeto_id = p_projeto_id;
  v_ok := v_hash is not null and crypt(coalesce(trim(p_pin), ''), v_hash) = v_hash;

  insert into public.autorizacoes (projeto_id, user_id, sucesso, expira_em)
  values (p_projeto_id, auth.uid(), v_ok,
          now() + make_interval(mins => public.pin_janela_minutos()));

  return v_ok;
end $$;

/** Janela de autorização aberta para o usuário logado neste projeto. */
create or replace function public.tem_autorizacao(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.autorizacoes
     where projeto_id = p_projeto_id and user_id = auth.uid()
       and sucesso and expira_em > now());
$$;

-- ---------------------------------------------------------------------------
-- 6. Convites por link
-- ---------------------------------------------------------------------------
/** Guarda só o sha256 do token: o link em si não fica no banco. */
create or replace function public.hash_token(p_token text)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

create or replace function public.criar_convite(
  p_projeto_id uuid, p_token text, p_papel public.papel_projeto,
  p_dias int default 7, p_max_usos int default 1)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_id uuid;
begin
  if not public.pode_administrar_projeto(p_projeto_id) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if char_length(coalesce(p_token, '')) < 24 then
    raise exception 'Token curto demais.' using errcode = 'check_violation';
  end if;

  insert into public.convites (projeto_id, token_hash, papel, criado_por, expira_em, max_usos)
  values (p_projeto_id, public.hash_token(p_token), p_papel, auth.uid(),
          now() + make_interval(days => greatest(1, least(p_dias, 90))),
          greatest(1, least(p_max_usos, 50)))
  returning id into v_id;
  return v_id;
end $$;

/**
 * Entra no projeto com o token do link. Vale a mesma regra de 0004: o vínculo é
 * pelo e-mail CONFIRMADO da conta. Devolve o id do projeto, ou null se o convite
 * não serve mais.
 */
create or replace function public.aceitar_convite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_convite public.convites;
  v_email   text;
begin
  v_email := public.email_confirmado();
  if v_email is null then
    raise exception 'Confirme o e-mail da sua conta antes de aceitar o convite.' using errcode = 'check_violation';
  end if;

  select * into v_convite
    from public.convites
   where token_hash = public.hash_token(p_token)
     and not revogado and expira_em > now() and usos < max_usos
   for update;

  if not found then
    return null;
  end if;

  insert into public.projeto_membros (projeto_id, email, papel)
  values (v_convite.projeto_id, v_email, v_convite.papel)
  on conflict (projeto_id, email_normalizado) do update set papel = excluded.papel;

  update public.convites set usos = usos + 1 where id = v_convite.id;
  return v_convite.projeto_id;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Policies
-- ---------------------------------------------------------------------------
-- investimentos e estimativas de IA: capital é assunto de dono e admin
do $$
declare t text;
begin
  foreach t in array array['investimentos', 'estimativas_ia'] loop
    execute format('drop policy if exists %I on public.%I', t || '_ver', t);
    execute format('drop policy if exists %I on public.%I', t || '_escrever', t);
    execute format($f$
      create policy %I on public.%I for select to authenticated
        using (public.pode_ver_investimentos(projeto_id))
    $f$, t || '_ver', t);
    execute format($f$
      create policy %I on public.%I for all to authenticated
        using (public.pode_ver_investimentos(projeto_id))
        with check (public.pode_ver_investimentos(projeto_id))
    $f$, t || '_escrever', t);
  end loop;
end $$;

-- vendas e despesas: todo mundo vê e lança; alterar/excluir é de quem pode
-- alterar OU de quem lançou e abriu a janela com o PIN
do $$
declare t text;
begin
  foreach t in array array['vendas', 'despesas'] loop
    execute format('drop policy if exists %I on public.%I', t || '_ver', t);
    execute format('drop policy if exists %I on public.%I', t || '_escrever', t);
    execute format('drop policy if exists %I on public.%I', t || '_lancar', t);
    execute format('drop policy if exists %I on public.%I', t || '_alterar', t);
    execute format('drop policy if exists %I on public.%I', t || '_excluir', t);

    execute format($f$
      create policy %I on public.%I for select to authenticated
        using (public.pode_ver_projeto(projeto_id))
    $f$, t || '_ver', t);

    execute format($f$
      create policy %I on public.%I for insert to authenticated
        with check (public.pode_lancar(projeto_id))
    $f$, t || '_lancar', t);

    execute format($f$
      create policy %I on public.%I for update to authenticated
        using (public.pode_alterar(projeto_id)
            or (public.pode_lancar(projeto_id) and public.tem_autorizacao(projeto_id)))
        with check (public.pode_alterar(projeto_id)
            or (public.pode_lancar(projeto_id) and public.tem_autorizacao(projeto_id)))
    $f$, t || '_alterar', t);

    execute format($f$
      create policy %I on public.%I for delete to authenticated
        using (public.pode_alterar(projeto_id)
            or (public.pode_lancar(projeto_id) and public.tem_autorizacao(projeto_id)))
    $f$, t || '_excluir', t);
  end loop;
end $$;

-- participantes: todos veem a divisão; só dono e admin mexem
drop policy if exists participantes_ver on public.participantes;
create policy participantes_ver on public.participantes
  for select to authenticated using (public.pode_ver_projeto(projeto_id));
drop policy if exists participantes_escrever on public.participantes;
create policy participantes_escrever on public.participantes
  for all to authenticated
  using (public.pode_administrar_projeto(projeto_id))
  with check (public.pode_administrar_projeto(projeto_id));

-- membros: todos veem quem tem acesso; dono e admin convidam e removem
drop policy if exists projeto_membros_gerir on public.projeto_membros;
create policy projeto_membros_gerir on public.projeto_membros
  for all to authenticated
  using (public.pode_administrar_projeto(projeto_id))
  with check (public.pode_administrar_projeto(projeto_id));

-- projeto: admin também edita a estrutura; excluir continua só do dono
drop policy if exists projetos_alterar on public.projetos;
create policy projetos_alterar on public.projetos
  for update to authenticated
  using (public.pode_administrar_projeto(id))
  with check (public.pode_administrar_projeto(id));

grant select on public.autorizacoes to authenticated;
grant select, insert, update, delete on public.convites to authenticated;
grant execute on function public.pode_administrar_projeto(uuid) to authenticated;
grant execute on function public.pode_ver_investimentos(uuid) to authenticated;
grant execute on function public.pode_lancar(uuid) to authenticated;
grant execute on function public.pode_alterar(uuid) to authenticated;
grant execute on function public.tem_pin(uuid) to authenticated;
grant execute on function public.tem_autorizacao(uuid) to authenticated;
grant execute on function public.definir_pin(uuid, text) to authenticated;
grant execute on function public.remover_pin(uuid) to authenticated;
grant execute on function public.autorizar_pin(uuid, text) to authenticated;
grant execute on function public.criar_convite(uuid, text, public.papel_projeto, int, int) to authenticated;
grant execute on function public.aceitar_convite(text) to authenticated;
