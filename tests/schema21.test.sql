-- Testes da 0031 — pesquisa de mercado e painel (psql -v ON_ERROR_STOP=1, rodar da raiz). Desfaz tudo.
begin;
\i supabase/migrations/0031_pesquisa_mercado.sql
\i supabase/migrations/0031_pesquisa_mercado.sql
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'adm@a.com', now()),
  ('a0000000-0000-0000-0000-00000000000c', 'outro-adm@a.com', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'adm@b.com', now()),
  ('e0000000-0000-0000-0000-00000000000e', 'master@plataforma.com', now()) on conflict do nothing;
insert into plataforma_admins (email) values ('master@plataforma.com') on conflict do nothing;
insert into organizacoes (id, nome, criado_por) values
  ('a1000000-0000-0000-0000-000000000000', 'A', 'a0000000-0000-0000-0000-00000000000a'),
  ('b1000000-0000-0000-0000-000000000000', 'B', 'b0000000-0000-0000-0000-00000000000b');
insert into organizacao_membros (organizacao_id, email) values
  ('a1000000-0000-0000-0000-000000000000', 'adm@a.com'), ('a1000000-0000-0000-0000-000000000000', 'outro-adm@a.com'),
  ('b1000000-0000-0000-0000-000000000000', 'adm@b.com');
insert into commodities (id, organizacao_id, nome) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'Iron ore'),
  ('b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000000', 'Soja da B');
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';

-- 1. A abre e conclui uma pesquisa; preço desconhecido fica null.
insert into pesquisas_mercado (id, organizacao_id, commodity_id, base, pergunta, sessao_id)
values ('a8000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
        'CFR China', 'Iron ore 62% Fe CFR China', 'sesn_teste_1');
do $$ begin
  update pesquisas_mercado set status = 'concluida' where id = 'a8000000-0000-0000-0000-000000000001';
  raise exception 'DEVERIA falhar: concluída sem data de conclusão';
exception when check_violation then raise notice 'OK pesquisa concluída precisa de data de conclusão'; end $$;
update pesquisas_mercado set status = 'concluida', concluida_em = now(), preco = 104.5, moeda = 'USD', unidade = 'USD/dmt',
       data_cotacao = '2026-09-24', tipo = 'futuro', fonte = 'SGX', aproximacao = true
 where id = 'a8000000-0000-0000-0000-000000000001';
do $$ begin
  update pesquisas_mercado set cotacoes = '{"xangai": 1}' where id = 'a8000000-0000-0000-0000-000000000001';
  raise exception 'DEVERIA falhar: cotações fora de lista';
exception when check_violation then raise notice 'OK cotações das bolsas são sempre uma lista'; end $$;
do $$ begin
  update pesquisas_mercado set modo = 'outro' where id = 'a8000000-0000-0000-0000-000000000001';
  raise exception 'DEVERIA falhar: modo fora da lista';
exception when check_violation then raise notice 'OK modo da pesquisa só livre ou bolsas'; end $$;
do $$ begin
  update pesquisas_mercado set tipo = 'chute' where id = 'a8000000-0000-0000-0000-000000000001';
  raise exception 'DEVERIA falhar: tipo fora da lista';
exception when check_violation then raise notice 'OK tipo da cotação só da lista'; end $$;

-- 2. Pesquisa só para commodity da própria empresa.
do $$ begin
  insert into pesquisas_mercado (organizacao_id, commodity_id, pergunta)
  values ('a1000000-0000-0000-0000-000000000000', 'b2000000-0000-0000-0000-000000000001', 'x');
  raise exception 'DEVERIA falhar: commodity da B';
exception when foreign_key_violation then raise notice 'OK pesquisa só de commodity da própria empresa'; end $$;

-- 3. Painel: até 3 commodities, e cada usuário só vê a própria escolha.
insert into painel_commodities (organizacao_id, commodity_ids)
values ('a1000000-0000-0000-0000-000000000000', array['a2000000-0000-0000-0000-000000000001']::uuid[]);
do $$ begin
  update painel_commodities set commodity_ids = array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  raise exception 'DEVERIA falhar: 4 commodities';
exception when check_violation then raise notice 'OK painel aceita no máximo 3 commodities'; end $$;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000c';
do $$ declare n int; begin
  select count(*) into n from painel_commodities; if n <> 0 then raise exception 'viu a escolha de outro usuário'; end if;
  select count(*) into n from pesquisas_mercado; if n <> 1 then raise exception 'outro ADM da empresa deveria ver a pesquisa'; end if;
  raise notice 'OK escolha do painel é de cada usuário; pesquisa é da empresa';
end $$;

-- 4. Sigilo: outra empresa e master não veem as pesquisas.
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
do $$ begin
  if exists (select 1 from pesquisas_mercado) then raise exception 'B viu pesquisa da A'; end if;
  raise notice 'OK outra empresa não vê a pesquisa';
end $$;
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
do $$ begin
  if exists (select 1 from pesquisas_mercado) then raise exception 'master viu pesquisa'; end if;
  raise notice 'OK master não vê a pesquisa';
end $$;
rollback;
