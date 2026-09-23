-- 0011 — Contrato financeiro e faturas da plataforma
--
-- O painel do master pedia "ativos, inativos, em débito, contrato e a receber",
-- e nada disso existia: a empresa tinha plano e assentos, mas nenhum valor e
-- nenhuma cobrança. Sem fatura não há como saber quem está em débito.
--
--   1. organizacoes ganha o valor do contrato (mensalidade, setup, vencimento).
--   2. faturas — uma linha por cobrança, paga ou não.
--   3. painel_plataforma() e a nova empresas_da_plataforma(), que somam isso.
--
-- Dinheiro é somado POR MOEDA. Somar BRL com USD num widget só dá um número que
-- não existe; o painel devolve uma linha por moeda e a tela mostra o que houver.
--
-- Idempotente. Depende de 0009 e 0010. Delimitador nomeado ($fn$) porque o
-- editor de SQL do Supabase quebra funções delimitadas com $$ no primeiro ";".

-- ---------------------------------------------------------------------------
-- 1. O contrato
-- ---------------------------------------------------------------------------
alter table public.organizacoes add column if not exists mensalidade    numeric(14,2) not null default 0;
alter table public.organizacoes add column if not exists setup          numeric(14,2) not null default 0;
alter table public.organizacoes add column if not exists moeda_cobranca public.moeda  not null default 'BRL';
-- Até 28 para existir em fevereiro; dia 29, 30 e 31 não existem todo mês.
alter table public.organizacoes add column if not exists dia_vencimento int not null default 10;

do $ck$ begin
  alter table public.organizacoes add constraint organizacoes_cobranca_ck check (
    mensalidade >= 0 and setup >= 0 and dia_vencimento between 1 and 28
  );
exception when duplicate_object then null; end $ck$;

-- ---------------------------------------------------------------------------
-- 2. Faturas
-- ---------------------------------------------------------------------------
do $tp$ begin
  create type public.tipo_fatura as enum ('mensalidade', 'setup', 'outro');
exception when duplicate_object then null; end $tp$;

create table if not exists public.faturas (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  tipo           public.tipo_fatura not null default 'mensalidade',
  -- Mês de referência, sempre no dia 1. Setup e avulsas também têm competência,
  -- para o relatório mensal não ter buraco.
  competencia    date not null,
  descricao      text check (descricao is null or char_length(descricao) <= 200),
  valor          numeric(14,2) not null check (valor > 0),
  moeda          public.moeda not null default 'BRL',
  vencimento     date not null,
  -- null = em aberto. Vencida e em aberto é o que define "em débito".
  pago_em        date,
  criado_em      timestamptz not null default now()
);
create index if not exists faturas_org_idx on public.faturas (organizacao_id, vencimento desc);
create index if not exists faturas_abertas_idx on public.faturas (vencimento) where pago_em is null;

-- Uma mensalidade por mês por empresa; setup e avulsas podem repetir.
create unique index if not exists faturas_mensalidade_uq
  on public.faturas (organizacao_id, competencia) where tipo = 'mensalidade';

-- Competência é sempre o primeiro dia do mês: sem isso, "março" vira várias
-- datas diferentes e o agrupamento mensal deixa de fechar.
create or replace function public.tg_fatura_competencia()
returns trigger language plpgsql set search_path = public as $fn$
begin
  new.competencia := date_trunc('month', new.competencia)::date;
  return new;
end $fn$;

drop trigger if exists fatura_competencia on public.faturas;
create trigger fatura_competencia
  before insert or update on public.faturas
  for each row execute function public.tg_fatura_competencia();

-- Faturamento é assunto da plataforma: nem a empresa vê a própria fatura aqui.
alter table public.faturas enable row level security;
drop policy if exists faturas_master on public.faturas;
create policy faturas_master on public.faturas
  for all to authenticated using (public.eh_master()) with check (public.eh_master());

-- ---------------------------------------------------------------------------
-- 3. O painel
-- ---------------------------------------------------------------------------

/** A empresa tem alguma fatura vencida e em aberto? */
create or replace function public.empresa_em_debito(p_organizacao_id uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.faturas f
     where f.organizacao_id = p_organizacao_id
       and f.pago_em is null and f.vencimento < current_date
  );
$fn$;

/**
 * Panorama macro, uma linha por moeda.
 *
 * As contagens repetem em todas as linhas (empresa não tem moeda, cobrança
 * tem); com uma moeda só — o caso normal — a tela lê a primeira linha e pronto.
 */
drop function if exists public.painel_plataforma();
create function public.painel_plataforma()
returns table (moeda public.moeda, ativas int, inativas int, em_debito int, contrato_mensal numeric, a_receber numeric, em_atraso numeric, recebido_mes numeric)
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.eh_master() then
    raise exception 'Somente a administração da plataforma vê este painel.' using errcode = 'insufficient_privilege';
  end if;
  return query
    with moedas as (
      -- BRL sempre entra: sem nenhuma empresa cadastrada, a lista sairia vazia e
      -- o painel devolveria zero linhas — tela em branco no lugar de zeros.
      select m from (select o.moeda_cobranca as m from public.organizacoes o
                     union select f.moeda from public.faturas f
                     union select 'BRL'::public.moeda) t
    ),
    contagens as (
      select count(*) filter (where public.empresa_ativa(o.id))::int as ativas,
             count(*) filter (where not public.empresa_ativa(o.id))::int as inativas,
             count(*) filter (where public.empresa_em_debito(o.id))::int as em_debito
        from public.organizacoes o
    )
    select mo.m, c.ativas, c.inativas, c.em_debito,
           coalesce((select sum(o.mensalidade) from public.organizacoes o
                      where o.moeda_cobranca = mo.m and public.empresa_ativa(o.id)), 0),
           -- A receber: em aberto e ainda dentro do prazo.
           coalesce((select sum(f.valor) from public.faturas f
                      where f.moeda = mo.m and f.pago_em is null and f.vencimento >= current_date), 0),
           coalesce((select sum(f.valor) from public.faturas f
                      where f.moeda = mo.m and f.pago_em is null and f.vencimento < current_date), 0),
           coalesce((select sum(f.valor) from public.faturas f
                      where f.moeda = mo.m and f.pago_em >= date_trunc('month', current_date)::date), 0)
      from moedas mo cross join contagens c
     order by mo.m;
end $fn$;

-- Ganha as colunas de cobrança; trocar o tipo de retorno exige recriar.
drop function if exists public.empresas_da_plataforma();
create function public.empresas_da_plataforma()
returns table (id uuid, nome text, plano public.plano_empresa, assentos int, ativa boolean, vigencia_ate date, em_dia boolean, em_debito boolean, assentos_usados int, projetos int, admins text[], mensalidade numeric, setup numeric, moeda_cobranca public.moeda, dia_vencimento int, aberto numeric, atrasado numeric, proximo_vencimento date, criado_em timestamptz)
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.eh_master() then
    raise exception 'Somente a administração da plataforma vê este painel.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select o.id, o.nome, o.plano, o.assentos, o.ativa, o.vigencia_ate,
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
end $fn$;

/**
 * Gera as mensalidades do mês para quem está em dia de contrato.
 *
 * Idempotente pelo índice único: rodar duas vezes no mesmo mês não duplica.
 * Devolve quantas criou.
 */
create or replace function public.gerar_mensalidades(p_competencia date default current_date)
returns int language plpgsql security definer set search_path = public as $fn$
declare
  v_mes date := date_trunc('month', p_competencia)::date;
  v_n int;
begin
  if not public.eh_master() then
    raise exception 'Somente a administração da plataforma emite faturas.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.faturas (organizacao_id, tipo, competencia, valor, moeda, vencimento)
  select o.id, 'mensalidade', v_mes, o.mensalidade, o.moeda_cobranca,
         v_mes + (o.dia_vencimento - 1)
    from public.organizacoes o
   where o.mensalidade > 0 and public.empresa_ativa(o.id)
  on conflict do nothing;

  get diagnostics v_n = row_count;
  return v_n;
end $fn$;

grant select, insert, update, delete on public.faturas to authenticated;
grant execute on function public.empresa_em_debito(uuid) to authenticated;
grant execute on function public.painel_plataforma() to authenticated;
grant execute on function public.empresas_da_plataforma() to authenticated;
grant execute on function public.gerar_mensalidades(date) to authenticated;
