-- Testes funcionais da migration (executar com psql -v ON_ERROR_STOP=1). Roda em transação e desfaz tudo.
begin;
insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');

-- usuário 1
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into projetos (nome, data_inicio, moeda, tipo_parceria, participacao_pct)
values ('JV Mineração', '2026-01-15', 'USD', 'joint_venture', 40) returning id \gset p_

-- colunas geradas
insert into investimentos (projeto_id, item, categoria, quantidade, valor_unitario, data)
values (:'p_id', 'Barcaças', 'logistica', 4, 250000, '2026-01-20'),
       (:'p_id', 'Empurradores', 'logistica', 2, 400000, '2026-02-05'),
       (:'p_id', 'Britador', 'infraestrutura', 1, 300000, '2026-02-10');
insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, data)
values (:'p_id', 'venda_produto', 10000, 'Toneladas', 80, '2026-03-01'),
       (:'p_id', 'venda_produto', 20000, 'Toneladas', 85, '2026-04-01'),
       (:'p_id', 'venda_produto', 12000, 'Toneladas', 90, '2026-06-01');

do $$ declare v numeric; begin
  select sum(valor_total) into v from investimentos; if v <> 2100000 then raise exception 'valor_total errado: %', v; end if;
  select sum(receita_total) into v from vendas;      if v <> 3580000 then raise exception 'receita_total errada: %', v; end if;
end $$;

-- fluxo mensal: 6 meses contínuos (jan..jun), maio zerado, break-even em abril
do $$ declare n int; r record; begin
  select count(*) into n from fluxo_mensal((select id from projetos limit 1)); if n <> 6 then raise exception 'esperava 6 meses, veio %', n; end if;
  select * into r from fluxo_mensal((select id from projetos limit 1)) where mes = '2026-05-01';
  if r.receita <> 0 or r.investimento <> 0 then raise exception 'maio deveria ser zero'; end if;
  select min(mes) into r from fluxo_mensal((select id from projetos limit 1)) where rec_acumulada >= inv_acumulado and inv_acumulado > 0;
  if r.min <> '2026-04-01' then raise exception 'break-even errado: %', r.min; end if;
end $$;

-- participação: 40 (dono) + 35 + 25 = 100 ok; +1 deve falhar
insert into participantes (projeto_id, nome, tipo, percentual) values (:'p_id', 'Mineradora X', 'parceiro_jv', 35);
insert into participantes (projeto_id, nome, tipo, percentual) values (:'p_id', 'Fundo Y', 'investidor', 25);
savepoint sp1;
do $$ begin
  insert into participantes (projeto_id, nome, tipo, percentual) select id, 'Extra', 'socio', 1 from projetos;
  raise exception 'DEVERIA ter falhado: soma > 100';
exception when check_violation then raise notice 'OK trava 100%%: %', sqlerrm; end $$;
rollback to savepoint sp1;
savepoint sp2;
do $$ begin
  update projetos set participacao_pct = 41;
  raise exception 'DEVERIA ter falhado: dono 41 + 60 > 100';
exception when check_violation then raise notice 'OK trava update dono: %', sqlerrm; end $$;
rollback to savepoint sp2;

-- checks numéricos
savepoint sp3;
do $$ begin
  insert into investimentos (projeto_id, item, categoria, quantidade, valor_unitario, data) select id, 'X', 'operacional', 0, 10, '2026-01-01' from projetos;
  raise exception 'DEVERIA ter falhado: quantidade 0';
exception when check_violation then raise notice 'OK check quantidade > 0'; end $$;
rollback to savepoint sp3;

-- nome duplicado (case-insensitive)
savepoint sp4;
do $$ begin
  insert into projetos (nome, data_inicio) values ('jv mineração', '2026-01-01');
  raise exception 'DEVERIA ter falhado: nome duplicado';
exception when unique_violation then raise notice 'OK nome único'; end $$;
rollback to savepoint sp4;

-- RLS: usuário 2 não enxerga nada do usuário 1
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ declare n int; begin
  select count(*) into n from projetos;      if n <> 0 then raise exception 'RLS projetos vazou'; end if;
  select count(*) into n from investimentos; if n <> 0 then raise exception 'RLS investimentos vazou'; end if;
  select count(*) into n from vendas;        if n <> 0 then raise exception 'RLS vendas vazou'; end if;
  select count(*) into n from participantes; if n <> 0 then raise exception 'RLS participantes vazou'; end if;
  raise notice 'OK RLS isolado';
end $$;

-- cascata
reset role;
delete from projetos;
do $$ declare n int; begin
  select count(*) into n from investimentos; if n <> 0 then raise exception 'cascata falhou'; end if;
  raise notice 'OK cascata';
end $$;

rollback;
