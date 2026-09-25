-- Testes da 0025 — conta avulsa não ganha empresa nem projeto
-- (psql -v ON_ERROR_STOP=1, rodar da raiz do repositório). Desfaz tudo.
begin;
\i supabase/migrations/0025_cadastro_so_por_convite.sql
\i supabase/migrations/0025_cadastro_so_por_convite.sql
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'adm@empresa-a.com', now()),
  ('c0000000-0000-0000-0000-00000000000c', 'curioso@qualquer.com', now()),
  ('e0000000-0000-0000-0000-00000000000e', 'master@plataforma.com', now())
on conflict do nothing;
insert into plataforma_admins (email) values ('master@plataforma.com') on conflict do nothing;

set local role authenticated;

-- 1. Conta avulsa (e-mail confirmado, sem convite): não cria empresa nem projeto.
set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-00000000000c';
do $$ begin
  perform criar_organizacao('Empresa do curioso');
  raise exception 'DEVERIA falhar: conta avulsa criando empresa';
exception when insufficient_privilege then raise notice 'OK conta avulsa não cria a própria empresa'; end $$;
do $$ begin
  insert into organizacoes (nome, criado_por) values ('Direto na tabela', 'c0000000-0000-0000-0000-00000000000c');
  raise exception 'DEVERIA falhar: insert direto em organizacoes';
exception when insufficient_privilege then raise notice 'OK nem direto na tabela'; end $$;
do $$ begin
  insert into projetos (nome, data_inicio, moeda) values ('Projeto solto', '2026-09-25', 'BRL');
  raise exception 'DEVERIA falhar: projeto fora de empresa';
exception when insufficient_privilege then raise notice 'OK conta avulsa não cria projeto'; end $$;

-- 2. O master continua liberando empresa (criar_empresa) e o ADM dela cria projeto.
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
do $$ declare v uuid; begin
  v := criar_empresa('Empresa A', 'adm@empresa-a.com', 'boutique', 5, null);
  if v is null then raise exception 'criar_empresa não devolveu id'; end if;
  raise notice 'OK master libera empresa';
end $$;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$ declare n int; begin
  insert into projetos (nome, data_inicio, moeda) values ('Projeto da empresa', '2026-09-25', 'USD');
  select count(*) into n from projetos where nome = 'Projeto da empresa' and organizacao_id = minha_organizacao();
  if n <> 1 then raise exception 'projeto do ADM não nasceu na empresa dele'; end if;
  raise notice 'OK ADM cria projeto, e ele nasce na empresa';
end $$;

-- 3. Admin do PROJETO (convidado, fora da empresa) edita o projeto, mas não o muda de empresa.
set local role postgres;
insert into auth.users (id, email, email_confirmed_at) values
  ('b0000000-0000-0000-0000-00000000000b', 'adm@empresa-b.com', now()),
  ('d0000000-0000-0000-0000-00000000000d', 'admin-do-projeto@x.com', now()) on conflict do nothing;
insert into organizacoes (id, nome, criado_por) values
  ('b1000000-0000-0000-0000-000000000000', 'Empresa B', 'b0000000-0000-0000-0000-00000000000b');
insert into organizacao_membros (organizacao_id, email) values ('b1000000-0000-0000-0000-000000000000', 'adm@empresa-b.com');
insert into projeto_membros (projeto_id, email, papel)
select id, 'admin-do-projeto@x.com', 'admin' from projetos where nome = 'Projeto da empresa';
set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-00000000000d';
do $$ declare n int; begin
  update projetos set status = 'encerrado' where nome = 'Projeto da empresa';
  get diagnostics n = row_count; if n <> 1 then raise exception 'admin do projeto não editou (% linhas)', n; end if;
  raise notice 'OK admin do projeto edita o projeto da empresa';
end $$;
do $$ begin
  update projetos set organizacao_id = 'b1000000-0000-0000-0000-000000000000' where nome = 'Projeto da empresa';
  raise exception 'DEVERIA falhar: admin do projeto levando o projeto para outra empresa';
exception when insufficient_privilege then raise notice 'OK ninguém muda o projeto para empresa de que não é ADM'; end $$;
rollback;
