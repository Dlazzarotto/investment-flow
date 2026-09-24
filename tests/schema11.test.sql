-- Testes da 0020 — pagamento negociado (psql -v ON_ERROR_STOP=1). Roda em transação e desfaz tudo.
begin;
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'adm@empresa-a.com', now()) on conflict do nothing;
insert into organizacoes (id, nome, criado_por) values
  ('a1000000-0000-0000-0000-000000000000', 'DSD', 'a0000000-0000-0000-0000-00000000000a');
insert into organizacao_membros (organizacao_id, email) values ('a1000000-0000-0000-0000-000000000000', 'adm@empresa-a.com');
insert into commodities (id, organizacao_id, nome) values
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'Minério de ferro');
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';

-- 30 % antecipado, saldo 5 dias depois da BL; sem informar a forma antiga.
insert into contratos (organizacao_id, commodity_id, volume, preco_fixo, pct_antecipado, evento_saldo, prazo_pagamento_dias)
values ('a1000000-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000001', 1000, 100, 30, 'bl', 5);
do $$ declare r record; begin
  select pct_antecipado, evento_saldo, forma_pagamento into r from contratos;
  if r.pct_antecipado <> 30 or r.evento_saldo <> 'bl' or r.forma_pagamento is not null then
    raise exception 'pagamento gravado errado: % % %', r.pct_antecipado, r.evento_saldo, r.forma_pagamento; end if;
  raise notice 'OK 30 %% antecipado + saldo na BL, sem carta de crédito como forma de pagamento';
end $$;
do $$ begin
  insert into contratos (organizacao_id, commodity_id, volume, preco_fixo, pct_antecipado)
  values ('a1000000-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000001', 1, 1, 120);
  raise exception 'DEVERIA falhar: 120 %% antecipado';
exception when check_violation then raise notice 'OK antecipado vai de 0 a 100 %%'; end $$;
do $$ begin
  insert into contratos (organizacao_id, commodity_id, volume, preco_fixo, pct_antecipado)
  values ('a1000000-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000001', 1, 1, 100);
  raise notice 'OK 100 %% antecipado é aceito';
end $$;
-- Venda FOB dentro do país: 100 % no carregamento do caminhão, em reais.
insert into contratos (organizacao_id, commodity_id, volume, preco_fixo, incoterm, moeda, evento_saldo)
values ('a1000000-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000001', 300, 450, 'FOB', 'BRL', 'carregamento');
do $$ begin
  if not exists (select 1 from contratos where evento_saldo = 'carregamento' and moeda = 'BRL') then
    raise exception 'venda FOB doméstica não gravou'; end if;
  raise notice 'OK venda FOB no país paga no carregamento do caminhão';
end $$;
rollback;
