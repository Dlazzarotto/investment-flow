-- Testes da 0033 — contratos do projeto na carteira (psql -v ON_ERROR_STOP=1, rodar da raiz). Desfaz tudo.
begin;
\i supabase/migrations/0033_contratos_na_carteira.sql
\i supabase/migrations/0033_contratos_na_carteira.sql
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'adm@a.com', now()),
  ('a0000000-0000-0000-0000-0000000000b1', 'investidor@x.com', now()),
  ('a0000000-0000-0000-0000-0000000000c1', 'curioso@x.com', now()) on conflict do nothing;
insert into organizacoes (id, nome, criado_por) values
  ('a1000000-0000-0000-0000-000000000000', 'A', 'a0000000-0000-0000-0000-00000000000a');
insert into organizacao_membros (organizacao_id, email) values ('a1000000-0000-0000-0000-000000000000', 'adm@a.com');
insert into commodities (id, organizacao_id, nome) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'Ferro');
insert into projetos (id, nome, data_inicio, moeda, organizacao_id, owner_id) values
  ('a4000000-0000-0000-0000-000000000001', 'Mina', '2026-09-01', 'BRL', 'a1000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-00000000000a');
insert into participantes (projeto_id, nome, tipo, percentual, email) values
  ('a4000000-0000-0000-0000-000000000001', 'Investidor', 'investidor', 10, 'investidor@x.com');
insert into contratos (organizacao_id, commodity_id, projeto_id, conta, direcao, papel, status, volume, moeda,
                       tipo_preco, preco_fixo, data_assinatura) values
  ('a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
   'projeto', 'venda', 'principal', 'concluido', 10, 'BRL', 'fixo', 50, '2026-09-20'),     -- entra
  ('a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
   'projeto', 'venda', 'principal', 'concluido', 10, 'USD', 'fixo', 999, '2026-09-20'),    -- outra moeda: fora
  ('a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
   'projeto', 'venda', 'principal', 'assinado', 10, 'BRL', 'fixo', 70, '2026-09-20');      -- não concluído: fora
set local role authenticated;

set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-0000000000b1';
do $$ declare n int; v numeric; begin
  if exists (select 1 from contratos) then raise exception 'investidor leu a tabela contratos'; end if;
  select count(*), sum(valor) into n, v from contratos_do_projeto('a4000000-0000-0000-0000-000000000001');
  if n <> 1 or v <> 500 then raise exception 'investidor viu % linhas / % (esperado 1 / 500)', n, v; end if;
  raise notice 'OK investidor vê só os números dos contratos que entram no resultado';
end $$;

set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-0000000000c1';
do $$ begin
  if exists (select 1 from contratos_do_projeto('a4000000-0000-0000-0000-000000000001')) then
    raise exception 'quem não é do projeto viu contratos'; end if;
  raise notice 'OK quem não é do projeto não vê nada';
end $$;
rollback;
