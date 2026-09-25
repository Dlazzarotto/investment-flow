-- Testes da 0023/0024 — master da plataforma separado da conta da DSD
-- (psql -v ON_ERROR_STOP=1, rodar da raiz do repositório). Desfaz tudo.
begin;
insert into auth.users (id, email, email_confirmed_at) values
  ('d0000000-0000-0000-0000-00000000000d', 'david.lazzarotto@gmail.com', now()) on conflict do nothing;
insert into organizacoes (id, nome, criado_por) values
  ('d1000000-0000-0000-0000-000000000000', 'DSD', 'd0000000-0000-0000-0000-00000000000d');
insert into organizacao_membros (organizacao_id, email) values ('d1000000-0000-0000-0000-000000000000', 'david.lazzarotto@gmail.com');
insert into plataforma_admins (email) values ('david.lazzarotto@gmail.com') on conflict do nothing;

-- 1. 0023 acrescenta o master novo; rodar duas vezes não duplica.
\i supabase/migrations/0023_master_plataforma.sql
\i supabase/migrations/0023_master_plataforma.sql
do $$ declare n int; begin
  select count(*) into n from plataforma_admins where email_normalizado = 'david@peaceontax.com';
  if n <> 1 then raise exception 'master novo: % linha(s)', n; end if;
  raise notice 'OK 0023 cadastra o master novo uma vez só';
end $$;

-- 2. 0024 ANTES de a conta nova existir: não apaga o gmail (plataforma nunca fica sem master).
\i supabase/migrations/0024_master_sai_da_dsd.sql
do $$ begin
  if not exists (select 1 from plataforma_admins where email_normalizado = 'david.lazzarotto@gmail.com') then
    raise exception 'gmail saiu antes de o master novo existir';
  end if;
  raise notice 'OK 0024 sem conta nova não mexe em nada';
end $$;

-- 3. Conta nova criada mas SEM confirmar o e-mail: ainda não troca, e ela não é master.
insert into auth.users (id, email, email_confirmed_at) values
  ('f0000000-0000-0000-0000-00000000000f', 'David@PeaceOnTax.com', null);
\i supabase/migrations/0024_master_sai_da_dsd.sql
set local role authenticated;
set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-00000000000f';
do $$ begin
  if eh_master() then raise exception 'e-mail não confirmado virou master'; end if;
  raise notice 'OK conta sem e-mail confirmado não é master';
end $$;
set local role postgres;
do $$ begin
  if not exists (select 1 from plataforma_admins where email_normalizado = 'david.lazzarotto@gmail.com') then
    raise exception 'gmail saiu com o master novo sem confirmação';
  end if;
  raise notice 'OK 0024 espera a confirmação do e-mail';
end $$;

-- 4. Confirmado: a 0024 tira o gmail do master; ele continua ADM da DSD.
update auth.users set email_confirmed_at = now() where id = 'f0000000-0000-0000-0000-00000000000f';
\i supabase/migrations/0024_master_sai_da_dsd.sql
\i supabase/migrations/0024_master_sai_da_dsd.sql
set local role authenticated;
set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-00000000000f';
do $$ begin
  if not eh_master() then raise exception 'master novo não é master'; end if;
  if minha_organizacao() is not null then raise exception 'master novo ficou dentro de uma empresa'; end if;
  raise notice 'OK conta da plataforma é master e não é de empresa nenhuma';
end $$;
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-00000000000d';
do $$ begin
  if eh_master() then raise exception 'gmail continua master'; end if;
  if minha_organizacao() is distinct from 'd1000000-0000-0000-0000-000000000000' then
    raise exception 'gmail perdeu a DSD';
  end if;
  raise notice 'OK gmail é só ADM da DSD';
end $$;
rollback;
