-- 0034 — situação da empresa: ATIVA, PARADA ou ARQUIVADA (pedido do usuário).
-- "Só terá acesso ao sistema cliente ativo": empresa parada ou arquivada não tem
-- ninguém dentro — ADM, equipe, dono de projeto nem investidor. Os dados ficam
-- guardados; reativar devolve tudo como estava. Até aqui, "suspensa" só impedia
-- gravar (0012/0013): a leitura continuava aberta.
--
-- `ativa` (boolean, usada por empresa_ativa, cobrança e painel) passa a ser espelho
-- de `situacao`, garantido por CHECK: nenhuma das duas muda sem a outra.
-- Vigência vencida continua como era (só leitura): quem bloqueia o acesso é o master,
-- de propósito, e não uma data que passou sem ninguém ver.
--
-- Idempotente; rodar em blocos se o editor truncar. O último select tem que voltar true.

-- ---------------------------------------------------------------------------
-- BLOCO 1 — a coluna
-- ---------------------------------------------------------------------------
do $tipo$ begin
  create type public.situacao_empresa as enum ('ativa', 'parada', 'arquivada');
exception when duplicate_object then null;
end $tipo$;

alter table public.organizacoes add column if not exists situacao public.situacao_empresa not null default 'ativa';
update public.organizacoes set situacao = 'parada' where not ativa and situacao = 'ativa';
update public.organizacoes set situacao = 'ativa' where ativa and situacao <> 'ativa';

alter table public.organizacoes drop constraint if exists organizacoes_situacao_ativa_ck;
alter table public.organizacoes add constraint organizacoes_situacao_ativa_ck check (ativa = (situacao = 'ativa'));

-- ---------------------------------------------------------------------------
-- BLOCO 2 — só o master muda a situação (como plano, assentos e vigência)
-- ---------------------------------------------------------------------------
create or replace function public.tg_contrato_so_master()
returns trigger language plpgsql security definer set search_path = public as $csm$
begin
  if (new.plano, new.assentos, new.ativa, new.vigencia_ate, new.situacao)
     is distinct from (old.plano, old.assentos, old.ativa, old.vigencia_ate, old.situacao)
     and not public.eh_master() then
    raise exception 'Plano, assentos e vigência são definidos pela administração da plataforma.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $csm$;

-- ---------------------------------------------------------------------------
-- BLOCO 3 — quem entra: empresa que não está ATIVA não tem ninguém dentro
-- ---------------------------------------------------------------------------
create or replace function public.empresa_acessivel(p_organizacao_id uuid)
returns boolean language sql stable security definer set search_path = public as $acs$
  -- Sem empresa (projeto antigo, fora de organização) continua acessível ao dono.
  select coalesce((select o.situacao = 'ativa' from public.organizacoes o where o.id = p_organizacao_id), true);
$acs$;
grant execute on function public.empresa_acessivel(uuid) to authenticated;

create or replace function public.eh_admin_organizacao(p_organizacao_id uuid)
returns boolean language sql stable security definer set search_path = public as $adm$
  select exists (
    select 1 from public.organizacao_membros m
     where m.organizacao_id = p_organizacao_id
       and m.email_normalizado = public.email_confirmado())
     and public.empresa_acessivel(p_organizacao_id);
$adm$;

create or replace function public.papel_no_projeto(p_projeto_id uuid)
returns text language sql stable security definer set search_path = public as $pap$
  select case
    -- Empresa parada ou arquivada: ninguém entra, nem o dono (0034).
    when not public.empresa_acessivel((select p.organizacao_id from public.projetos p where p.id = p_projeto_id)) then null
    -- O dono continua entrando com a empresa suspensa por contrato, mas só lê.
    when exists (select 1 from public.projetos p
                  where p.id = p_projeto_id and p.owner_id = auth.uid()) then 'dono'
    when not public.projeto_liberado(p_projeto_id) then null
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
    when exists (select 1 from public.participantes pp
                  where pp.projeto_id = p_projeto_id
                    and pp.email_normalizado = public.email_confirmado()) then 'investidor'
    else null
  end;
$pap$;

-- O dono lê o próprio projeto direto por owner_id (projetos_ver, estimativas_ia_owner),
-- sem passar por papel_no_projeto: a trava de leitura precisa estar na tabela também.
drop policy if exists projetos_empresa_acessivel on public.projetos;
create policy projetos_empresa_acessivel on public.projetos as restrictive for select
  using (public.empresa_acessivel(organizacao_id));

-- Para a tela explicar o bloqueio ao ADM (ele já não lê a própria linha em organizacoes).
create or replace function public.minha_empresa_bloqueada()
returns table (nome text, situacao text) language sql stable security definer set search_path = public as $blq$
  select o.nome, o.situacao::text
    from public.organizacao_membros m
    join public.organizacoes o on o.id = m.organizacao_id
   where m.email_normalizado = public.email_confirmado() and o.situacao <> 'ativa'
   limit 1;
$blq$;
grant execute on function public.minha_empresa_bloqueada() to authenticated;

-- ---------------------------------------------------------------------------
-- BLOCO 4 — painel do master com a situação (muda o formato: drop + create)
-- ---------------------------------------------------------------------------
drop function if exists public.empresas_da_plataforma();
create function public.empresas_da_plataforma()
returns table (id uuid, nome text, plano public.plano_empresa, assentos integer, ativa boolean, situacao text,
               vigencia_ate date, em_dia boolean, em_debito boolean, assentos_usados integer, projetos integer,
               admins text[], mensalidade numeric, setup numeric, moeda_cobranca public.moeda, dia_vencimento integer,
               aberto numeric, atrasado numeric, proximo_vencimento date, criado_em timestamptz)
language plpgsql security definer set search_path = public as $emp$
begin
  if not public.eh_master() then
    raise exception 'Somente a administração da plataforma vê este painel.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select o.id, o.nome, o.plano, o.assentos, o.ativa, o.situacao::text, o.vigencia_ate,
           public.empresa_ativa(o.id),
           public.empresa_em_debito(o.id),
           public.assentos_ocupados(o.id),
           (select count(*)::int from public.projetos p where p.organizacao_id = o.id),
           coalesce((select array_agg(m.email order by m.criado_em)
                       from public.organizacao_membros m where m.organizacao_id = o.id), '{}'::text[]),
           o.mensalidade, o.setup, o.moeda_cobranca, o.dia_vencimento,
           coalesce((select sum(f.valor) from public.faturas f
                      where f.organizacao_id = o.id and f.pago_em is null), 0),
           coalesce((select sum(f.valor) from public.faturas f
                      where f.organizacao_id = o.id and f.pago_em is null and f.vencimento < current_date), 0),
           (select min(f.vencimento) from public.faturas f
             where f.organizacao_id = o.id and f.pago_em is null),
           o.criado_em
      from public.organizacoes o
     order by o.criado_em desc;
end $emp$;
grant execute on function public.empresas_da_plataforma() to authenticated;

drop function if exists public.painel_plataforma();
create function public.painel_plataforma()
returns table (moeda public.moeda, ativas integer, inativas integer, arquivadas integer, em_debito integer,
               contrato_mensal numeric, a_receber numeric, em_atraso numeric, recebido_mes numeric)
language plpgsql security definer set search_path = public as $pnl$
begin
  if not public.eh_master() then
    raise exception 'Somente a administração da plataforma vê este painel.' using errcode = 'insufficient_privilege';
  end if;
  return query
    with moedas as (
      select t.m from (select o.moeda_cobranca as m from public.organizacoes o
                       union select f.moeda from public.faturas f
                       union select 'BRL'::public.moeda) t
    ),
    contagens as (
      -- Arquivada sai de "inativas": é empresa encerrada, não cliente a recuperar.
      select count(*) filter (where public.empresa_ativa(o.id))::int as ativas,
             count(*) filter (where not public.empresa_ativa(o.id) and o.situacao <> 'arquivada')::int as inativas,
             count(*) filter (where o.situacao = 'arquivada')::int as arquivadas,
             count(*) filter (where public.empresa_em_debito(o.id))::int as em_debito
        from public.organizacoes o
    )
    select mo.m, c.ativas, c.inativas, c.arquivadas, c.em_debito,
           coalesce((select sum(o.mensalidade) from public.organizacoes o
                      where o.moeda_cobranca = mo.m and public.empresa_ativa(o.id)), 0),
           coalesce((select sum(f.valor) from public.faturas f
                      where f.moeda = mo.m and f.pago_em is null and f.vencimento >= current_date), 0),
           coalesce((select sum(f.valor) from public.faturas f
                      where f.moeda = mo.m and f.pago_em is null and f.vencimento < current_date), 0),
           coalesce((select sum(f.valor) from public.faturas f
                      where f.moeda = mo.m and f.pago_em >= date_trunc('month', current_date)::date), 0)
      from moedas mo cross join contagens c
     order by mo.m;
end $pnl$;
grant execute on function public.painel_plataforma() to authenticated;

-- ---------------------------------------------------------------------------
-- BLOCO 5 — conferência: tem que voltar true em todas as colunas.
-- ---------------------------------------------------------------------------
select
  exists (select 1 from information_schema.columns where table_name = 'organizacoes' and column_name = 'situacao') as coluna,
  exists (select 1 from pg_constraint where conname = 'organizacoes_situacao_ativa_ck') as espelho_ativa,
  (select prosrc like '%empresa_acessivel%' from pg_proc where proname = 'papel_no_projeto') as papel_bloqueia,
  (select prosrc like '%empresa_acessivel%' from pg_proc where proname = 'eh_admin_organizacao') as adm_bloqueia,
  exists (select 1 from pg_proc where proname = 'minha_empresa_bloqueada') as aviso,
  exists (select 1 from pg_policies where policyname = 'projetos_empresa_acessivel') as projeto_bloqueia,
  exists (select 1 from pg_proc p where p.proname = 'painel_plataforma'
                 and pg_get_function_result(p.oid) like '%arquivadas%') as painel;
