-- Testes da 0027 — um e-mail, uma empresa (psql -v ON_ERROR_STOP=1, rodar da raiz). Desfaz tudo.
begin;
\i supabase/migrations/0027_uma_empresa_por_email.sql
\i supabase/migrations/0027_uma_empresa_por_email.sql
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'adm@dsd.com', now()),
  ('e0000000-0000-0000-0000-00000000000e', 'master@plataforma.com', now()) on conflict do nothing;
insert into plataforma_admins (email) values ('master@plataforma.com') on conflict do nothing;
set local role authenticated;
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
select criar_empresa('DSD', 'adm@dsd.com', 'boutique', 5, null);

-- 1. Master libera empresa nova com o e-mail do ADM da DSD: recusado, e a empresa não fica pela metade.
do $$ declare n int; begin
  begin
    perform criar_empresa('Concorrente', ' ADM@dsd.com ', 'boutique', 5, null);
    raise exception 'DEVERIA falhar: mesmo e-mail em duas empresas';
  exception when unique_violation then null; end;
  select count(*) into n from organizacoes where nome = 'Concorrente';
  if n <> 0 then raise exception 'empresa ficou criada sem ADM'; end if;
  raise notice 'OK master não põe o ADM de uma empresa em outra (e nada fica pela metade)';
end $$;

-- 2. Empresa nova nasce zerada.
select criar_empresa('Nova Trading', 'adm@nova.com', 'avaliacao', 3, null);
set local role postgres;
do $$ declare n int; v uuid := (select id from organizacoes where nome = 'Nova Trading'); begin
  select (select count(*) from clientes where organizacao_id = v)
       + (select count(*) from fornecedores where organizacao_id = v)
       + (select count(*) from commodities where organizacao_id = v)
       + (select count(*) from projetos where organizacao_id = v)
       + (select count(*) from contratos where organizacao_id = v) into n;
  if n <> 0 then raise exception 'empresa nova nasceu com % registro(s)', n; end if;
  raise notice 'OK empresa nova nasce zerada';
end $$;
set local role authenticated;

-- 3. O ADM da DSD tenta incluir como sócio quem administra a Nova: recusado.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$ begin
  insert into organizacao_membros (organizacao_id, email)
  values ((select id from organizacoes where nome = 'DSD'), 'adm@nova.com');
  raise exception 'DEVERIA falhar: sócio de outra empresa';
exception when unique_violation then raise notice 'OK ADM não traz para a sua empresa quem é de outra'; end $$;
rollback;
