-- Testes da 0028 — excluir empresa vazia; master fora das empresas (psql -v ON_ERROR_STOP=1, rodar da raiz). Desfaz tudo.
begin;
\i supabase/migrations/0028_excluir_empresa.sql
\i supabase/migrations/0028_excluir_empresa.sql
insert into auth.users (id, email, email_confirmed_at) values
  ('e0000000-0000-0000-0000-00000000000e', 'master@plataforma.com', now()),
  ('a0000000-0000-0000-0000-00000000000a', 'adm@cheia.com', now()) on conflict do nothing;
insert into plataforma_admins (email) values ('master@plataforma.com') on conflict do nothing;
set local role authenticated;
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
select criar_empresa('Teste Vazia', 'adm@vazia.com', 'avaliacao', 3, null) is not null as criada;
select criar_empresa('Cheia', 'adm@cheia.com', 'avaliacao', 3, null) is not null as criada;
set local role postgres;
insert into clientes (organizacao_id, nome, tipos) select id, 'Cliente', '{comprador}' from organizacoes where nome = 'Cheia';
set local role authenticated;

-- 1. Remover o único administrador continua recusado.
do $$ begin
  delete from organizacao_membros where email_normalizado = 'adm@vazia.com';
  raise exception 'DEVERIA falhar: último administrador';
exception when check_violation then raise notice 'OK último administrador não sai (empresa não fica órfã)'; end $$;

-- 2. Master exclui a empresa vazia (com o administrador junto).
do $$ begin
  if not excluir_empresa((select id from organizacoes where nome = 'Teste Vazia')) then raise exception 'não excluiu a vazia'; end if;
  if exists (select 1 from organizacoes where nome = 'Teste Vazia') then raise exception 'empresa ficou'; end if;
  raise notice 'OK master exclui empresa vazia';
end $$;

-- 3. Empresa com dados não se exclui — nada some.
do $$ begin
  if excluir_empresa((select id from organizacoes where nome = 'Cheia')) then raise exception 'excluiu empresa com cliente'; end if;
  if not exists (select 1 from organizacoes where nome = 'Cheia') then raise exception 'empresa com dados sumiu'; end if;
  raise notice 'OK empresa com dados não se exclui (suspende-se)';
end $$;

-- 4. O ADM de uma empresa não exclui empresa nenhuma, nem a própria.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
set local role postgres;
delete from clientes;
set local role authenticated;
do $$ begin
  if excluir_empresa((select id from organizacoes where nome = 'Cheia')) then raise exception 'ADM excluiu empresa'; end if;
  raise notice 'OK só o master exclui empresa';
end $$;

-- 5. O master não vira administrador de empresa (nem pelo criar_empresa, nem por inclusão).
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
do $$ begin
  perform criar_empresa('Do master', 'Master@Plataforma.com', 'avaliacao', 3, null);
  raise exception 'DEVERIA falhar: master como ADM';
exception when check_violation then raise notice 'OK master não é ADM de empresa (criar_empresa)'; end $$;
do $$ begin
  insert into organizacao_membros (organizacao_id, email)
  values ((select id from organizacoes where nome = 'Cheia'), 'master@plataforma.com');
  raise exception 'DEVERIA falhar: master incluído como ADM';
exception when check_violation then raise notice 'OK master não é ADM de empresa (inclusão)'; end $$;
rollback;
