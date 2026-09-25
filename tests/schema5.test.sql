-- Testes da migration 0005 (executar com psql -v ON_ERROR_STOP=1). Roda em transação e desfaz tudo.
begin;
insert into auth.users (id, email, email_confirmed_at)
values ('11111111-1111-1111-1111-111111111111', 'dono@exemplo.com', now()) on conflict do nothing;
-- 0025: projeto só nasce dentro de uma empresa. O dono dos projetos de teste é ADM de
-- uma, criada aqui como o master criaria (a conta não cria a própria).
update auth.users set email = coalesce(email, 'dono-legado@x.com'), email_confirmed_at = coalesce(email_confirmed_at, now())
 where id = '11111111-1111-1111-1111-111111111111';
insert into organizacoes (id, nome, criado_por) values
  ('0f000000-0000-0000-0000-000000000000', 'Empresa de teste', '11111111-1111-1111-1111-111111111111') on conflict do nothing;
insert into organizacao_membros (organizacao_id, email)
select '0f000000-0000-0000-0000-000000000000', email from auth.users where id = '11111111-1111-1111-1111-111111111111'
on conflict do nothing;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into projetos (nome, data_inicio, moeda, participacao_pct)
values ('Custos', '2026-01-01', 'USD', 100) returning id \gset p_

-- ---------------------------------------------------------------------------
-- custo_total: mercadoria + frete + (impostos + comissão) sobre a receita
-- 10.000 t × 80 = 800.000 de receita
--   mercadoria 10.000 × 45 = 450.000
--   frete      10.000 ×  8 =  80.000
--   impostos   800.000 × 3,5 % = 28.000
--   comissão   800.000 × 1,5 % = 12.000
--   custo_total = 570.000  ·  margem = 230.000
-- ---------------------------------------------------------------------------
insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, data,
                    custo_unitario, frete_unitario, impostos_pct, comissao_pct)
values (:'p_id', 'venda_produto', 10000, 'Toneladas', 80, '2026-03-01', 45, 8, 3.5, 1.5);

do $$ declare r numeric; c numeric; begin
  select receita_total, custo_total into r, c from vendas;
  if r <> 800000 then raise exception 'receita errada: %', r; end if;
  if c <> 570000 then raise exception 'custo_total errado: % (esperava 570000)', c; end if;
  if r - c <> 230000 then raise exception 'margem errada: %', r - c; end if;
  raise notice 'OK custo_total e margem';
end $$;

-- venda sem custo informado continua valendo receita cheia (linhas antigas)
insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, data)
values (:'p_id', 'venda_produto', 1000, 'Toneladas', 90, '2026-04-01');
do $$ declare c numeric; begin
  select custo_total into c from vendas where data = '2026-04-01';
  if c <> 0 then raise exception 'venda sem custo deveria ter custo_total 0, veio %', c; end if;
  raise notice 'OK venda sem custo (compatível com o que já existia)';
end $$;

-- custo_total é gerado: não aceita valor vindo de fora
savepoint s0;
do $$ begin
  update vendas set custo_total = 1;
  raise exception 'DEVERIA falhar: custo_total é coluna gerada';
exception when others then raise notice 'OK custo_total não aceita escrita: %', sqlerrm; end $$;
rollback to savepoint s0;

-- percentuais fora da faixa e custos negativos
savepoint s1;
do $$ begin
  insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, data, impostos_pct)
  select id, 'venda_produto', 1, 'Toneladas', 1, '2026-05-01', 101 from projetos;
  raise exception 'DEVERIA falhar: imposto 101 %%';
exception when check_violation then raise notice 'OK imposto limitado a 100%%'; end $$;
rollback to savepoint s1;
savepoint s2;
do $$ begin
  insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, data, frete_unitario)
  select id, 'venda_produto', 1, 'Toneladas', 1, '2026-05-01', -1 from projetos;
  raise exception 'DEVERIA falhar: frete negativo';
exception when check_violation then raise notice 'OK frete não pode ser negativo'; end $$;
rollback to savepoint s2;

-- ---------------------------------------------------------------------------
-- despesas
-- ---------------------------------------------------------------------------
insert into investimentos (projeto_id, item, categoria, quantidade, valor_unitario, data)
values (:'p_id', 'Barcaça', 'logistica', 1, 1000000, '2026-01-10');
insert into despesas (projeto_id, descricao, categoria, valor, data) values
  (:'p_id', 'Folha de janeiro',  'pessoal',     60000, '2026-01-20'),
  (:'p_id', 'Diesel',            'combustivel', 40000, '2026-03-05');

savepoint s3;
do $$ begin
  insert into despesas (projeto_id, descricao, categoria, valor, data) select id, 'Zero', 'outros', 0, '2026-01-01' from projetos;
  raise exception 'DEVERIA falhar: despesa com valor 0';
exception when check_violation then raise notice 'OK despesa precisa ser > 0'; end $$;
rollback to savepoint s3;

-- ---------------------------------------------------------------------------
-- fluxo_mensal com as três saídas
-- jan: investimento 1.000.000 + despesa 60.000 = saída 1.060.000, receita 0
-- fev: nada
-- mar: custo de venda 570.000 + despesa 40.000 = saída 610.000, receita 800.000
-- abr: receita 90.000, custo 0
-- ---------------------------------------------------------------------------
do $$ declare n int; r record; begin
  select count(*) into n from fluxo_mensal((select id from projetos limit 1));
  if n <> 4 then raise exception 'esperava 4 meses (jan..abr), veio %', n; end if;

  select * into r from fluxo_mensal((select id from projetos limit 1)) where mes = '2026-01-01';
  if r.investimento <> 1000000 or r.despesas <> 60000 or r.custo_vendas <> 0 then raise exception 'janeiro errado: %', r; end if;
  if r.saida <> 1060000 then raise exception 'saída de janeiro errada: %', r.saida; end if;

  select * into r from fluxo_mensal((select id from projetos limit 1)) where mes = '2026-03-01';
  if r.custo_vendas <> 570000 or r.despesas <> 40000 or r.receita <> 800000 then raise exception 'março errado: %', r; end if;
  if r.saida <> 610000 then raise exception 'saída de março errada: %', r.saida; end if;
  if r.saldo_acumulado <> 800000 - 1670000 then raise exception 'saldo acumulado de março errado: %', r.saldo_acumulado; end if;

  select * into r from fluxo_mensal((select id from projetos limit 1)) where mes = '2026-04-01';
  -- total: receita 890.000 − saída 1.670.000 = −780.000
  if r.saldo_acumulado <> -780000 then raise exception 'saldo final errado: % (esperava -780000)', r.saldo_acumulado; end if;
  if r.rec_acumulada <> 890000 then raise exception 'receita acumulada errada: %', r.rec_acumulada; end if;
  if r.saida_acumulada <> 1670000 then raise exception 'saída acumulada errada: %', r.saida_acumulada; end if;
  raise notice 'OK fluxo_mensal com custo de venda e despesa';
end $$;

-- mês só com despesa entra na série (antes a série só nascia de investimento/venda)
do $$ declare n int; begin
  delete from investimentos; delete from vendas;
  select count(*) into n from fluxo_mensal((select id from projetos limit 1));
  if n <> 3 then raise exception 'série deveria ir de jan a mar só com despesas, veio %', n; end if;
  raise notice 'OK despesa sozinha sustenta a série mensal';
end $$;

-- RLS: quem não é do projeto não vê despesa
insert into auth.users (id, email, email_confirmed_at)
values ('55555555-5555-5555-5555-555555555555', 'estranho@exemplo.com', now()) on conflict do nothing;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$ declare n int; begin
  select count(*) into n from despesas; if n <> 0 then raise exception 'RLS despesas vazou'; end if;
  raise notice 'OK RLS despesas';
end $$;

-- cascata
reset role;
delete from projetos;
do $$ declare n int; begin
  select count(*) into n from despesas; if n <> 0 then raise exception 'cascata de despesas falhou'; end if;
  raise notice 'OK cascata de despesas';
end $$;

rollback;
