-- Testes da 0021 — documentos do cliente (psql -v ON_ERROR_STOP=1). Roda em transação e desfaz tudo.
-- Precisa do Storage do Supabase (no Postgres local: um stub com storage.buckets, storage.objects e foldername()).
begin;
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'adm@empresa-a.com', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'adm@empresa-b.com', now()),
  ('e0000000-0000-0000-0000-00000000000e', 'master@plataforma.com', now())
on conflict do nothing;
insert into plataforma_admins (email) values ('master@plataforma.com');
insert into organizacoes (id, nome, criado_por) values
  ('a1000000-0000-0000-0000-000000000000', 'DSD', 'a0000000-0000-0000-0000-00000000000a'),
  ('b1000000-0000-0000-0000-000000000000', 'Outra', 'b0000000-0000-0000-0000-00000000000b');
insert into organizacao_membros (organizacao_id, email) values
  ('a1000000-0000-0000-0000-000000000000', 'adm@empresa-a.com'),
  ('b1000000-0000-0000-0000-000000000000', 'adm@empresa-b.com');
insert into clientes (id, organizacao_id, nome, tipos) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'Shandong Steel', '{comprador}'),
  ('b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000000', 'Cliente da B', '{comprador}');

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';

-- 1. A arquiva o CIS do próprio cliente: arquivo no bucket + registro.
insert into storage.objects (bucket_id, name) values
  ('documentos', 'a1000000-0000-0000-0000-000000000000/clientes/a2000000-0000-0000-0000-000000000001/x-cis.pdf');
insert into cliente_documentos (organizacao_id, cliente_id, tipo, nome_arquivo, caminho, emitido_em, validade)
values ('a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'cis', 'cis.pdf',
        'a1000000-0000-0000-0000-000000000000/clientes/a2000000-0000-0000-0000-000000000001/x-cis.pdf', '2026-09-01', '2027-09-01');
do $$ declare n int; begin
  select count(*) into n from cliente_documentos; if n <> 1 then raise exception 'registro do CIS não entrou'; end if;
  select count(*) into n from storage.objects where bucket_id = 'documentos'; if n <> 1 then raise exception 'A não lê o próprio arquivo'; end if;
  raise notice 'OK CIS arquivado: arquivo no bucket e registro na ficha do cliente';
end $$;

-- 2. Travas.
do $$ begin
  insert into storage.objects (bucket_id, name) values
    ('documentos', 'b1000000-0000-0000-0000-000000000000/clientes/b2000000-0000-0000-0000-000000000001/intruso.pdf');
  raise exception 'DEVERIA falhar: A gravando na pasta da B';
exception when insufficient_privilege then raise notice 'OK ninguém grava na pasta de outra empresa'; end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('documentos', 'qualquer-coisa/arquivo.pdf');
  raise exception 'DEVERIA falhar: pasta que não é empresa';
exception when insufficient_privilege then raise notice 'OK pasta que não é uma empresa é recusada (sem erro de conversão)'; end $$;
do $$ begin
  insert into cliente_documentos (organizacao_id, cliente_id, nome_arquivo, caminho)
  values ('a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'x.pdf', 'b1000000-0000-0000-0000-000000000000/x.pdf');
  raise exception 'DEVERIA falhar: caminho fora da pasta da empresa';
exception when check_violation then raise notice 'OK registro só aponta para a pasta da própria empresa'; end $$;
do $$ begin
  insert into cliente_documentos (organizacao_id, cliente_id, nome_arquivo, caminho)
  values ('a1000000-0000-0000-0000-000000000000', 'b2000000-0000-0000-0000-000000000001', 'x.pdf', 'a1000000-0000-0000-0000-000000000000/y.pdf');
  raise exception 'DEVERIA falhar: cliente da B';
exception when foreign_key_violation then raise notice 'OK documento só de cliente da própria empresa'; end $$;
do $$ begin
  delete from clientes where id = 'a2000000-0000-0000-0000-000000000001';
  raise exception 'DEVERIA falhar: cliente com CIS';
exception when foreign_key_violation then raise notice 'OK cliente com documento arquivado não some'; end $$;

-- 3. Sigilo: outra empresa e o master não veem o arquivo nem o registro.
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
do $$ declare n int; begin
  select (select count(*) from cliente_documentos) + (select count(*) from storage.objects) into n;
  if n <> 0 then raise exception 'B viu % item(ns) da DSD', n; end if;
  delete from storage.objects; get diagnostics n = row_count; if n <> 0 then raise exception 'B apagou arquivo da DSD'; end if;
  raise notice 'OK outra empresa não vê nem apaga o CIS';
end $$;
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
do $$ declare n int; begin
  select (select count(*) from cliente_documentos) + (select count(*) from storage.objects) into n;
  if n <> 0 then raise exception 'master viu % item(ns)', n; end if;
  raise notice 'OK master não lê documento de cliente';
end $$;

-- 4. Empresa suspensa: lê o que tem, não envia arquivo novo.
set local role postgres;
update organizacoes set ativa = false where id = 'a1000000-0000-0000-0000-000000000000';
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$ declare n int; begin
  select count(*) into n from storage.objects; if n <> 1 then raise exception 'suspensa deveria ler o arquivo'; end if;
  raise notice 'OK suspensa ainda lê o CIS';
end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values
    ('documentos', 'a1000000-0000-0000-0000-000000000000/clientes/a2000000-0000-0000-0000-000000000001/novo.pdf');
  raise exception 'DEVERIA falhar: suspensa enviando';
exception when insufficient_privilege then raise notice 'OK suspensa não envia arquivo novo'; end $$;
rollback;
