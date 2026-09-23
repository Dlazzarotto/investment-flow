-- ============================================================================
-- 0007_investidores_aportes.sql — Organização de sócios, investidores e aportes
--
-- O que muda:
--   1. organizacoes / organizacao_membros: os sócios administradores. Quem é
--      admin da organização é 'admin' em TODO projeto vinculado a ela, sem
--      precisar ser convidado projeto a projeto.
--   2. papel 'investidor' em papel_projeto: entra pelo mesmo convite/e-mail dos
--      demais papéis, mas só LÊ, e só o que é dele: a própria linha em
--      participantes e os próprios aportes. Vendas e despesas ele vê (o retorno
--      dele depende disso); investimentos, membros e convites, não.
--   3. participantes.email: vínculo entre a linha da parceria e o login do
--      investidor (mesma regra dos membros: e-mail confirmado da conta).
--   4. aportes: como cada participante entrou no projeto — dinheiro, maquinário,
--      crédito, serviço, direito minerário, outro — com valor avaliado e data.
--   5. resumo_projeto(): totais do projeto para qualquer membro (o investidor
--      não lê investimentos linha a linha, mas precisa do total para o saldo).
--   6. minha_carteira(): os projetos em que o usuário logado é participante,
--      com a participação, os aportes e o saldo atribuível.
--
-- Executar depois de 0006. Idempotente.
-- ATENÇÃO: o 'add value' do enum não pode ser usado por outros comandos DENTRO
-- da mesma transação; por isso nenhuma policy abaixo compara com o enum — todas
-- comparam texto via papel_no_projeto().
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
alter type public.papel_projeto add value if not exists 'investidor';

do $$ begin
  create type public.tipo_aporte as enum
    ('dinheiro', 'maquinario', 'credito', 'servico', 'direito_minerario', 'outro');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Organização dos sócios
-- ---------------------------------------------------------------------------
create table if not exists public.organizacoes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (char_length(trim(nome)) between 1 and 120),
  criado_por uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criado_em  timestamptz not null default now()
);

create table if not exists public.organizacao_membros (
  id                uuid primary key default gen_random_uuid(),
  organizacao_id    uuid not null references public.organizacoes (id) on delete cascade,
  email             text not null check (char_length(trim(email)) between 3 and 320 and position('@' in email) > 1),
  email_normalizado text generated always as (lower(trim(email))) stored,
  criado_em         timestamptz not null default now()
);
create unique index if not exists organizacao_membros_uq on public.organizacao_membros (organizacao_id, email_normalizado);
create index if not exists organizacao_membros_email_idx on public.organizacao_membros (email_normalizado);

alter table public.projetos add column if not exists organizacao_id uuid references public.organizacoes (id) on delete set null;
create index if not exists projetos_organizacao_idx on public.projetos (organizacao_id);

/** O usuário logado é admin (sócio) desta organização? */
create or replace function public.eh_admin_organizacao(p_organizacao_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organizacao_membros m
     where m.organizacao_id = p_organizacao_id
       and m.email_normalizado = public.email_confirmado());
$$;

/** Organização do usuário logado (a primeira em que é sócio), ou null. */
create or replace function public.minha_organizacao()
returns uuid language sql stable security definer set search_path = public as $$
  select m.organizacao_id from public.organizacao_membros m
   where m.email_normalizado = public.email_confirmado()
   order by m.criado_em limit 1;
$$;

/** Cria a organização e já registra o criador como sócio (pelo e-mail confirmado). */
create or replace function public.criar_organizacao(p_nome text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_email text := public.email_confirmado();
  v_id uuid;
begin
  if v_email is null then
    raise exception 'Confirme o e-mail da conta antes de criar uma organização.' using errcode = 'check_violation';
  end if;
  if public.minha_organizacao() is not null then
    raise exception 'Você já pertence a uma organização.' using errcode = 'unique_violation';
  end if;
  insert into public.organizacoes (nome, criado_por) values (trim(p_nome), auth.uid()) returning id into v_id;
  insert into public.organizacao_membros (organizacao_id, email) values (v_id, v_email);
  return v_id;
end $$;

alter table public.organizacoes enable row level security;
alter table public.organizacao_membros enable row level security;

drop policy if exists organizacoes_ver on public.organizacoes;
create policy organizacoes_ver on public.organizacoes
  for select to authenticated using (public.eh_admin_organizacao(id));
drop policy if exists organizacoes_alterar on public.organizacoes;
create policy organizacoes_alterar on public.organizacoes
  for update to authenticated using (public.eh_admin_organizacao(id)) with check (public.eh_admin_organizacao(id));

drop policy if exists organizacao_membros_ver on public.organizacao_membros;
create policy organizacao_membros_ver on public.organizacao_membros
  for select to authenticated using (public.eh_admin_organizacao(organizacao_id));
drop policy if exists organizacao_membros_gerir on public.organizacao_membros;
create policy organizacao_membros_gerir on public.organizacao_membros
  for all to authenticated
  using (public.eh_admin_organizacao(organizacao_id))
  with check (public.eh_admin_organizacao(organizacao_id));

-- Projeto novo nasce vinculado à organização de quem o cria (se tiver uma).
create or replace function public.tg_projeto_organizacao_padrao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organizacao_id is null then
    new.organizacao_id := public.minha_organizacao();
  end if;
  return new;
end $$;
drop trigger if exists projeto_organizacao_padrao on public.projetos;
create trigger projeto_organizacao_padrao
  before insert on public.projetos
  for each row execute function public.tg_projeto_organizacao_padrao();

-- Um sócio nunca pode se remover se for o último (a organização ficaria órfã).
create or replace function public.tg_organizacao_ultimo_socio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.organizacao_membros where organizacao_id = old.organizacao_id) <= 1 then
    raise exception 'A organização precisa ter ao menos um sócio.' using errcode = 'check_violation';
  end if;
  return old;
end $$;
drop trigger if exists organizacao_ultimo_socio on public.organizacao_membros;
create trigger organizacao_ultimo_socio
  before delete on public.organizacao_membros
  for each row execute function public.tg_organizacao_ultimo_socio();

-- ---------------------------------------------------------------------------
-- 2b. participantes.email — vínculo com o login do investidor
-- ---------------------------------------------------------------------------
alter table public.participantes add column if not exists email text
  check (email is null or (char_length(trim(email)) between 3 and 320 and position('@' in email) > 1));
alter table public.participantes add column if not exists email_normalizado text
  generated always as (lower(trim(email))) stored;
create unique index if not exists participantes_projeto_email_uq
  on public.participantes (projeto_id, email_normalizado) where email_normalizado is not null;

-- ---------------------------------------------------------------------------
-- 3. Papel no projeto: dono → sócio da organização ('admin') → membro do projeto
--    → participante com e-mail cadastrado ('investidor', só leitura do que é dele)
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
    when exists (select 1 from public.projetos p
                  where p.id = p_projeto_id and p.organizacao_id is not null
                    and public.eh_admin_organizacao(p.organizacao_id)) then 'admin'
    when exists (select 1 from public.projeto_membros m
                  where m.projeto_id = p_projeto_id
                    and m.email_normalizado = public.email_confirmado())
      then (select m.papel::text from public.projeto_membros m
             where m.projeto_id = p_projeto_id
               and m.email_normalizado = public.email_confirmado()
             limit 1)
    -- participante com e-mail cadastrado entra como investidor sem precisar de convite
    when exists (select 1 from public.participantes pp
                  where pp.projeto_id = p_projeto_id
                    and pp.email_normalizado = public.email_confirmado()) then 'investidor'
    else null
  end;
$$;

-- CORREÇÃO (bug desde a 0004): a policy de SELECT de projetos era só função.
-- Em "insert ... returning" o Postgres valida a linha nova contra a policy de
-- SELECT, e a função (STABLE, subconsulta em projetos) ainda não enxerga a linha
-- recém-inserida → "new row violates row-level security policy" ao criar projeto.
-- O teste direto em owner_id enxerga a própria linha e resolve; a função continua
-- valendo para sócios, membros e investidores.
drop policy if exists projetos_ver on public.projetos;
create policy projetos_ver on public.projetos
  for select to authenticated
  using (owner_id = auth.uid() or public.pode_ver_projeto(id));

/** O usuário logado é investidor (somente leitura do que é dele) neste projeto? */
create or replace function public.eh_investidor(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.papel_no_projeto(p_projeto_id) = 'investidor';
$$;

-- ---------------------------------------------------------------------------
-- 4. participantes.email — vínculo com o login do investidor
-- ---------------------------------------------------------------------------
-- (colunas criadas na seção 2b, antes de papel_no_projeto usá-las)

/** Linha de participantes do usuário logado neste projeto (pelo e-mail confirmado), ou null. */
create or replace function public.participante_do_usuario(p_projeto_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select pp.id from public.participantes pp
   where pp.projeto_id = p_projeto_id
     and pp.email_normalizado = public.email_confirmado()
   limit 1;
$$;

-- investidor só vê a própria linha; os demais papéis veem a divisão inteira
drop policy if exists participantes_ver on public.participantes;
create policy participantes_ver on public.participantes
  for select to authenticated
  using (public.pode_ver_projeto(projeto_id)
         and (not public.eh_investidor(projeto_id) or id = public.participante_do_usuario(projeto_id)));

-- membros e convites: investidor não vê a lista de acessos
drop policy if exists projeto_membros_ver on public.projeto_membros;
create policy projeto_membros_ver on public.projeto_membros
  for select to authenticated
  using (public.pode_ver_projeto(projeto_id) and not public.eh_investidor(projeto_id));

-- ---------------------------------------------------------------------------
-- 5. Aportes — como cada participante entrou
-- ---------------------------------------------------------------------------
create table if not exists public.aportes (
  id              uuid primary key default gen_random_uuid(),
  projeto_id      uuid not null references public.projetos (id) on delete cascade,
  participante_id uuid not null references public.participantes (id) on delete cascade,
  tipo            public.tipo_aporte not null,
  descricao       text not null check (char_length(trim(descricao)) between 1 and 200),
  valor           numeric(18,2) not null check (valor > 0),
  data            date not null,
  observacoes     text check (observacoes is null or char_length(observacoes) <= 2000),
  criado_em       timestamptz not null default now()
);
create index if not exists aportes_projeto_idx on public.aportes (projeto_id, data);
create index if not exists aportes_participante_idx on public.aportes (participante_id);

-- o participante do aporte precisa ser do mesmo projeto
create or replace function public.tg_aporte_mesmo_projeto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.participantes pp where pp.id = new.participante_id and pp.projeto_id = new.projeto_id) then
    raise exception 'O participante do aporte não pertence a este projeto.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists aporte_mesmo_projeto on public.aportes;
create trigger aporte_mesmo_projeto
  before insert or update on public.aportes
  for each row execute function public.tg_aporte_mesmo_projeto();

alter table public.aportes enable row level security;

drop policy if exists aportes_ver on public.aportes;
create policy aportes_ver on public.aportes
  for select to authenticated
  using (public.pode_ver_projeto(projeto_id)
         and (not public.eh_investidor(projeto_id) or participante_id = public.participante_do_usuario(projeto_id)));

-- aporte é estrutura de capital: dono e admin (inclui sócios da organização)
drop policy if exists aportes_escrever on public.aportes;
create policy aportes_escrever on public.aportes
  for all to authenticated
  using (public.pode_administrar_projeto(projeto_id))
  with check (public.pode_administrar_projeto(projeto_id));

-- ---------------------------------------------------------------------------
-- 6. Totais do projeto para qualquer membro
-- ---------------------------------------------------------------------------
create or replace function public.resumo_projeto(p_projeto_id uuid)
returns table (
  investimento_total numeric,
  receita_total      numeric,
  custo_vendas_total numeric,
  despesas_total     numeric,
  saida_total        numeric,
  saldo              numeric,
  aportes_total      numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select i.v, v.r, v.c, d.v, i.v + v.c + d.v, v.r - (i.v + v.c + d.v), a.v
    from (select coalesce(sum(valor_total), 0) as v from public.investimentos where projeto_id = p_projeto_id) i,
         (select coalesce(sum(receita_total), 0) as r, coalesce(sum(custo_total), 0) as c from public.vendas where projeto_id = p_projeto_id) v,
         (select coalesce(sum(valor), 0) as v from public.despesas where projeto_id = p_projeto_id) d,
         (select coalesce(sum(valor), 0) as v from public.aportes where projeto_id = p_projeto_id) a
   where public.pode_ver_projeto(p_projeto_id);
$$;

-- ---------------------------------------------------------------------------
-- 7. Carteira do investidor
-- ---------------------------------------------------------------------------
create or replace function public.minha_carteira()
returns table (
  projeto_id          uuid,
  nome                text,
  moeda               public.moeda,
  tipo_parceria       public.tipo_parceria,
  data_inicio         date,
  participante_id     uuid,
  participante_nome   text,
  minha_pct           numeric,
  meus_aportes        numeric,
  investimento_total  numeric,
  receita_total       numeric,
  saida_total         numeric,
  saldo               numeric,
  saldo_atribuivel    numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nome, p.moeda, p.tipo_parceria, p.data_inicio,
         pp.id, pp.nome, pp.percentual,
         coalesce((select sum(a.valor) from public.aportes a where a.participante_id = pp.id), 0),
         r.investimento_total, r.receita_total, r.saida_total, r.saldo,
         round(r.saldo * pp.percentual / 100, 2)
    from public.participantes pp
    join public.projetos p on p.id = pp.projeto_id
    cross join lateral public.resumo_projeto(p.id) r
   where pp.email_normalizado = public.email_confirmado()
   order by p.nome;
$$;

-- ---------------------------------------------------------------------------
-- 8. Grants
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.organizacoes, public.organizacao_membros, public.aportes to authenticated;
grant execute on function public.eh_admin_organizacao(uuid) to authenticated;
grant execute on function public.minha_organizacao() to authenticated;
grant execute on function public.criar_organizacao(text) to authenticated;
grant execute on function public.eh_investidor(uuid) to authenticated;
grant execute on function public.participante_do_usuario(uuid) to authenticated;
grant execute on function public.resumo_projeto(uuid) to authenticated;
grant execute on function public.minha_carteira() to authenticated;
