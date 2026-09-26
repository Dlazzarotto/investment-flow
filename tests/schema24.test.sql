-- Testes da 0034 — situação da empresa (psql -v ON_ERROR_STOP=1, rodar da raiz). Desfaz tudo.
begin;
\i supabase/migrations/0034_situacao_empresa.sql
\i supabase/migrations/0034_situacao_empresa.sql
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'adm@a.com', now()),
  ('a0000000-0000-0000-0000-0000000000b1', 'investidor@x.com', now()),
  ('e0000000-0000-0000-0000-00000000000e', 'master@plataforma.com', now()) on conflict do nothing;
insert into plataforma_admins (email) values ('master@plataforma.com') on conflict do nothing;
insert into organizacoes (id, nome, criado_por) values
  ('a1000000-0000-0000-0000-000000000000', 'A', 'a0000000-0000-0000-0000-00000000000a');
insert into organizacao_membros (organizacao_id, email) values ('a1000000-0000-0000-0000-000000000000', 'adm@a.com');
insert into clientes (organizacao_id, nome) values ('a1000000-0000-0000-0000-000000000000', 'Cliente');
insert into projetos (id, nome, data_inicio, moeda, organizacao_id, owner_id) values
  ('a4000000-0000-0000-0000-000000000001', 'Mina', '2026-09-01', 'BRL', 'a1000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-00000000000a');
insert into participantes (projeto_id, nome, tipo, percentual, email) values
  ('a4000000-0000-0000-0000-000000000001', 'Investidor', 'investidor', 10, 'investidor@x.com');
set local role authenticated;

-- 1. Ativa: ADM e investidor entram.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$ begin
  if not exists (select 1 from clientes) or not exists (select 1 from projetos) then raise exception 'ADM de empresa ativa sem acesso'; end if;
  if exists (select 1 from minha_empresa_bloqueada()) then raise exception 'ativa aparece como bloqueada'; end if;
  raise notice 'OK empresa ativa: ADM entra';
end $$;

-- 2. O ADM não muda a situação da própria empresa.
do $$ begin
  update organizacoes set situacao = 'arquivada', ativa = false where id = 'a1000000-0000-0000-0000-000000000000';
  raise exception 'DEVERIA falhar: ADM mudou a situação';
exception when insufficient_privilege then raise notice 'OK só o master muda a situação'; end $$;

-- 3. Situação e "ativa" nunca divergem.
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
do $$ begin
  update organizacoes set situacao = 'parada' where id = 'a1000000-0000-0000-0000-000000000000';
  raise exception 'DEVERIA falhar: parada com ativa = true';
exception when check_violation then raise notice 'OK situação e ativa andam juntas'; end $$;

-- 4. Parada: ninguém entra — ADM, dono, investidor.
update organizacoes set situacao = 'parada', ativa = false where id = 'a1000000-0000-0000-0000-000000000000';
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$ declare r record; begin
  if exists (select 1 from clientes) then raise exception 'ADM de empresa parada leu clientes'; end if;
  if exists (select 1 from projetos) then raise exception 'dono de projeto de empresa parada leu o projeto'; end if;
  if exists (select 1 from organizacoes) then raise exception 'ADM de empresa parada leu a empresa'; end if;
  select * into r from minha_empresa_bloqueada();
  if r.situacao is distinct from 'parada' then raise exception 'aviso de bloqueio não veio (%).', r.situacao; end if;
  raise notice 'OK empresa parada: ADM e dono sem acesso, com aviso';
end $$;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-0000000000b1';
do $$ begin
  if exists (select 1 from resumo_projeto('a4000000-0000-0000-0000-000000000001')) then raise exception 'investidor de empresa parada viu o resultado'; end if;
  raise notice 'OK empresa parada: investidor sem acesso';
end $$;

-- 5. Arquivada conta à parte no painel do master; reativar devolve o acesso.
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
update organizacoes set situacao = 'arquivada', ativa = false where id = 'a1000000-0000-0000-0000-000000000000';
do $$ declare r record; begin
  select * into r from painel_plataforma() limit 1;
  if r.arquivadas < 1 then raise exception 'painel não contou a arquivada'; end if;
  if exists (select 1 from empresas_da_plataforma() e where e.id = 'a1000000-0000-0000-0000-000000000000' and e.situacao <> 'arquivada') then
    raise exception 'lista do master sem a situação'; end if;
  raise notice 'OK arquivada contada à parte no painel do master';
end $$;
update organizacoes set situacao = 'ativa', ativa = true where id = 'a1000000-0000-0000-0000-000000000000';
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$ begin
  if not exists (select 1 from clientes) then raise exception 'reativada sem acesso'; end if;
  raise notice 'OK reativar devolve o acesso, com os dados intactos';
end $$;
rollback;
