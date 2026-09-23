-- 0009 — Fundação da plataforma: master, empresa e histórico
--
-- Primeira etapa da reorganização v4. Tudo aqui é ADITIVO: nenhuma coluna muda
-- de sentido, nenhuma policy existente é afrouxada, e o sistema continua
-- funcionando exatamente como antes se nada desta migration for usado.
--
--   1. plataforma_admins — a conta master. Libera empresas e controla o plano;
--      NÃO lê projeto, custo, cliente nem documento de ninguém. É isso que
--      torna o sistema vendável a tradings concorrentes entre si.
--   2. organizacoes ganha o cadastro da empresa (dados + logo) e o contrato
--      (plano, assentos, vigência). O limite de assentos é do BANCO, não do
--      contrato em PDF: o que trava é um trigger.
--   3. historico — a trilha de auditoria. Entra agora porque histórico é a
--      mudança mais cara de fazer em retrospecto: o que não foi gravado no dia
--      não volta.
--
-- Idempotente. Depende de 0007 (organizacoes, email_confirmado) e 0008.

-- ---------------------------------------------------------------------------
-- 1. Conta master
-- ---------------------------------------------------------------------------
create table if not exists public.plataforma_admins (
  id                uuid primary key default gen_random_uuid(),
  email             text not null check (char_length(trim(email)) between 3 and 320 and position('@' in email) > 1),
  email_normalizado text generated always as (lower(trim(email))) stored,
  observacoes       text check (observacoes is null or char_length(observacoes) <= 500),
  criado_em         timestamptz not null default now()
);
create unique index if not exists plataforma_admins_uq on public.plataforma_admins (email_normalizado);

-- O primeiro master. Vínculo pelo e-mail CONFIRMADO da conta, como no resto do
-- sistema: sem confirmação, qualquer um se cadastraria com este endereço.
insert into public.plataforma_admins (email, observacoes)
values ('david.lazzarotto@gmail.com', 'Conta master inicial da plataforma.')
on conflict do nothing;

create or replace function public.eh_master()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.plataforma_admins a
     where a.email_normalizado = public.email_confirmado()
  );
$$;

-- A própria lista é secreta: ninguém consulta quem é master.
alter table public.plataforma_admins enable row level security;
drop policy if exists plataforma_admins_ver on public.plataforma_admins;
create policy plataforma_admins_ver on public.plataforma_admins
  for select to authenticated using (public.eh_master());

-- ---------------------------------------------------------------------------
-- 2. A empresa: cadastro e contrato
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.plano_empresa as enum ('avaliacao', 'boutique', 'consolidada');
exception when duplicate_object then null; end $$;

-- Cadastro (entra nos documentos comerciais: timbre, razão social, logo).
alter table public.organizacoes add column if not exists razao_social  text;
alter table public.organizacoes add column if not exists documento     text;
alter table public.organizacoes add column if not exists endereco      text;
alter table public.organizacoes add column if not exists cidade        text;
alter table public.organizacoes add column if not exists pais          text;
alter table public.organizacoes add column if not exists telefone      text;
alter table public.organizacoes add column if not exists email_contato text;
alter table public.organizacoes add column if not exists site          text;
-- Caminho no Storage, não a imagem: bytes em coluna incham cada leitura da linha.
alter table public.organizacoes add column if not exists logo_path     text;

-- Contrato. Só o master mexe nestas quatro (policy mais abaixo).
alter table public.organizacoes add column if not exists plano        public.plano_empresa not null default 'avaliacao';
-- null = sem teto (faixa consolidada). Conta a EQUIPE, não os clientes.
alter table public.organizacoes add column if not exists assentos     int check (assentos is null or assentos > 0);
alter table public.organizacoes add column if not exists ativa        boolean not null default true;
alter table public.organizacoes add column if not exists vigencia_ate date;

do $$ begin
  alter table public.organizacoes add constraint organizacoes_texto_ck check (
    (razao_social  is null or char_length(razao_social)  <= 200) and
    (documento     is null or char_length(documento)     <= 40)  and
    (endereco      is null or char_length(endereco)      <= 300) and
    (cidade        is null or char_length(cidade)        <= 120) and
    (pais          is null or char_length(pais)          <= 80)  and
    (telefone      is null or char_length(telefone)      <= 40)  and
    (email_contato is null or char_length(email_contato) <= 320) and
    (site          is null or char_length(site)          <= 300) and
    (logo_path     is null or char_length(logo_path)     <= 500)
  );
exception when duplicate_object then null; end $$;

/**
 * A empresa está em dia? Empresa suspensa ou com vigência vencida perde o
 * acesso sem que ninguém precise apagar dado nenhum.
 */
create or replace function public.empresa_ativa(p_organizacao_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select o.ativa and (o.vigencia_ate is null or o.vigencia_ate >= current_date)
      from public.organizacoes o where o.id = p_organizacao_id
  ), false);
$$;

/**
 * Assentos ocupados: a EQUIPE da empresa, não a carteira de clientes.
 *
 * Conta e-mails distintos entre os sócios da organização e os membros de
 * projeto com papel de trabalho. Investidor NÃO ocupa assento — uma trading
 * com trinta investidores não deve estourar o plano por causa deles. Se a
 * régra comercial for outra, é esta função que muda, e só ela.
 */
create or replace function public.assentos_ocupados(p_organizacao_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(distinct email)::int from (
    select m.email_normalizado as email
      from public.organizacao_membros m
     where m.organizacao_id = p_organizacao_id
    union
    select pm.email_normalizado
      from public.projeto_membros pm
      join public.projetos p on p.id = pm.projeto_id
     where p.organizacao_id = p_organizacao_id
       and pm.papel <> 'investidor'
  ) t;
$$;

/**
 * Trava do plano. O limite mora aqui e não no contrato: vender 5 assentos e
 * deixar entrar o sexto é o tipo de furo que só aparece na renovação.
 */
create or replace function public.tg_limite_assentos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_limite int;
  v_usados int;
begin
  if tg_table_name = 'organizacao_membros' then
    v_org := new.organizacao_id;
  else
    select p.organizacao_id into v_org from public.projetos p where p.id = new.projeto_id;
    if new.papel = 'investidor' then return new; end if;  -- cliente não ocupa assento
  end if;
  if v_org is null then return new; end if;

  select o.assentos into v_limite from public.organizacoes o where o.id = v_org;
  if v_limite is null then return new; end if;  -- plano sem teto

  v_usados := public.assentos_ocupados(v_org);
  if v_usados >= v_limite then
    raise exception 'O plano da empresa permite % assentos e todos estão ocupados.', v_limite
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists limite_assentos_organizacao on public.organizacao_membros;
create trigger limite_assentos_organizacao
  before insert on public.organizacao_membros
  for each row execute function public.tg_limite_assentos();

drop trigger if exists limite_assentos_projeto on public.projeto_membros;
create trigger limite_assentos_projeto
  before insert on public.projeto_membros
  for each row execute function public.tg_limite_assentos();

/**
 * O contrato é do master, mesmo morando na linha da empresa.
 *
 * A policy organizacoes_alterar (0007) deixa o ADM dar update na própria linha
 * — e agora essa linha carrega plano, assentos, vigência e o liga/desliga. Sem
 * esta trava, o cliente se promove sozinho para a faixa de cima. RLS não filtra
 * por coluna; por isso é trigger.
 */
create or replace function public.tg_contrato_so_master()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.plano, new.assentos, new.ativa, new.vigencia_ate)
     is distinct from (old.plano, old.assentos, old.ativa, old.vigencia_ate)
     and not public.eh_master() then
    raise exception 'Plano, assentos e vigência são definidos pela administração da plataforma.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

drop trigger if exists contrato_so_master on public.organizacoes;
create trigger contrato_so_master
  before update on public.organizacoes
  for each row execute function public.tg_contrato_so_master();

-- O master enxerga a empresa (é para quem ele vende) e mexe no contrato dela.
-- Nada além disto: projeto, custo, cliente e documento seguem fora do alcance,
-- porque as policies daquelas tabelas não mencionam eh_master().
drop policy if exists organizacoes_master_ver on public.organizacoes;
create policy organizacoes_master_ver on public.organizacoes
  for select to authenticated using (public.eh_master());

drop policy if exists organizacoes_master_criar on public.organizacoes;
create policy organizacoes_master_criar on public.organizacoes
  for insert to authenticated with check (public.eh_master());

drop policy if exists organizacoes_master_alterar on public.organizacoes;
create policy organizacoes_master_alterar on public.organizacoes
  for update to authenticated using (public.eh_master()) with check (public.eh_master());

-- Para o master saber quem usa cada empresa e conferir os assentos vendidos.
drop policy if exists organizacao_membros_master_ver on public.organizacao_membros;
create policy organizacao_membros_master_ver on public.organizacao_membros
  for select to authenticated using (public.eh_master());

-- ---------------------------------------------------------------------------
-- 3. Histórico (trilha de auditoria)
-- ---------------------------------------------------------------------------
create table if not exists public.historico (
  id             bigint primary key generated always as identity,
  organizacao_id uuid references public.organizacoes (id) on delete set null,
  projeto_id     uuid,
  tabela         text not null,
  registro_id    uuid,
  acao           text not null check (acao in ('insert', 'update', 'delete')),
  ator           uuid,
  ator_email     text,
  -- Só o que mudou, não a linha inteira: diff enxuto é o que se lê depois.
  antes          jsonb,
  depois         jsonb,
  quando         timestamptz not null default now()
);
create index if not exists historico_org_idx     on public.historico (organizacao_id, quando desc);
create index if not exists historico_projeto_idx on public.historico (projeto_id, quando desc);
create index if not exists historico_registro_idx on public.historico (tabela, registro_id, quando desc);

/**
 * Gatilho genérico de auditoria. Guarda apenas os campos que mudaram — a linha
 * inteira em cada update encheria a tabela de ruído e esconderia o que importa.
 *
 * O projeto vem do argumento do trigger: 'projeto_id' quando a tabela tem essa
 * coluna, 'id' quando a própria linha é o projeto, ou nada.
 */
create or replace function public.tg_historico()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_antes jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_depois jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_linha jsonb := coalesce(v_depois, v_antes);
  v_coluna text := tg_argv[0];
  v_projeto uuid;
  v_org uuid;
  v_mudou jsonb;
begin
  if v_coluna is not null and v_linha ? v_coluna then
    v_projeto := (v_linha ->> v_coluna)::uuid;
    select p.organizacao_id into v_org from public.projetos p where p.id = v_projeto;
  end if;

  if tg_op = 'UPDATE' then
    -- Só as chaves cujo valor mudou; update que não mudou nada não vira linha.
    select jsonb_object_agg(k, v_depois -> k) into v_mudou
      from jsonb_object_keys(v_depois) k
     where v_depois -> k is distinct from v_antes -> k;
    if v_mudou is null then return null; end if;
    v_antes := (select jsonb_object_agg(k, v_antes -> k) from jsonb_object_keys(v_mudou) k);
    v_depois := v_mudou;
  end if;

  insert into public.historico (organizacao_id, projeto_id, tabela, registro_id, acao, ator, ator_email, antes, depois)
  values (v_org, v_projeto, tg_table_name, (v_linha ->> 'id')::uuid, lower(tg_op),
          auth.uid(), public.email_confirmado(), v_antes, v_depois);
  return null;  -- AFTER trigger: o valor de retorno é ignorado
end $$;

-- Tabelas onde "quem mudou o quê" tem consequência em dinheiro ou em acesso.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('projetos', 'id'), ('investimentos', 'projeto_id'), ('vendas', 'projeto_id'),
      ('despesas', 'projeto_id'), ('participantes', 'projeto_id'), ('aportes', 'projeto_id'),
      ('projeto_membros', 'projeto_id'), ('projeto_etapas', 'projeto_id'),
      ('estimativas_custo', 'projeto_id'), ('estimativa_itens', null)
    ) as v(tabela, coluna)
  loop
    if to_regclass('public.' || t.tabela) is not null then
      execute format('drop trigger if exists historico_%1$s on public.%1$I', t.tabela);
      execute format(
        'create trigger historico_%1$s after insert or update or delete on public.%1$I
           for each row execute function public.tg_historico(%2$s)',
        t.tabela, case when t.coluna is null then '' else quote_literal(t.coluna) end);
    end if;
  end loop;
end $$;

-- Quem administra o projeto lê o histórico dele; o resto da equipe, não. O
-- master também não: a trilha conta o que a empresa fez, e ele não lê dado dela.
alter table public.historico enable row level security;
drop policy if exists historico_ver on public.historico;
create policy historico_ver on public.historico
  for select to authenticated
  using (projeto_id is not null and public.pode_administrar_projeto(projeto_id));

grant select on public.historico to authenticated;
grant select on public.plataforma_admins to authenticated;
grant execute on function public.eh_master() to authenticated;
grant execute on function public.empresa_ativa(uuid) to authenticated;
grant execute on function public.assentos_ocupados(uuid) to authenticated;
