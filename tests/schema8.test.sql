-- Testes de painel_empresa() — 0016 + 0017 (psql -v ON_ERROR_STOP=1). Roda em transação e desfaz tudo.
-- Usuários: A (ADM e dono dos projetos da empresa A), S (sócio da empresa A, não é dono de nada),
-- B (ADM da empresa B), C (ADM de empresa sem projeto), D (ADM de empresa só em BRL),
-- M (master da plataforma, sem empresa) e X (estranho).
begin;
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'adm@empresa-a.com',   now()),
  ('a0000000-0000-0000-0000-00000000005a', 'socio@empresa-a.com', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'adm@empresa-b.com',   now()),
  ('c0000000-0000-0000-0000-00000000000c', 'adm@empresa-c.com',   now()),
  ('d0000000-0000-0000-0000-00000000000d', 'adm@empresa-d.com',   now()),
  ('e0000000-0000-0000-0000-00000000000e', 'master@plataforma.com', now()),
  ('f0000000-0000-0000-0000-00000000000f', 'fora@x.com',          now())
on conflict do nothing;

insert into plataforma_admins (email) values ('master@plataforma.com');
insert into organizacoes (id, nome, criado_por) values
  ('a1000000-0000-0000-0000-000000000000', 'Empresa A', 'a0000000-0000-0000-0000-00000000000a'),
  ('b1000000-0000-0000-0000-000000000000', 'Empresa B', 'b0000000-0000-0000-0000-00000000000b'),
  ('c1000000-0000-0000-0000-000000000000', 'Empresa C', 'c0000000-0000-0000-0000-00000000000c'),
  ('d1000000-0000-0000-0000-000000000000', 'Empresa D', 'd0000000-0000-0000-0000-00000000000d');
insert into organizacao_membros (organizacao_id, email) values
  ('a1000000-0000-0000-0000-000000000000', 'adm@empresa-a.com'),
  ('a1000000-0000-0000-0000-000000000000', 'socio@empresa-a.com'),
  ('b1000000-0000-0000-0000-000000000000', 'adm@empresa-b.com'),
  ('c1000000-0000-0000-0000-000000000000', 'adm@empresa-c.com'),
  ('d1000000-0000-0000-0000-000000000000', 'adm@empresa-d.com');

-- Empresa A: um projeto em USD e um em BRL, mais um projeto SOLTO (sem empresa) que não entra na conta.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
insert into projetos (nome, data_inicio, moeda, organizacao_id) values
  ('A em dólar', '2026-01-01', 'USD', 'a1000000-0000-0000-0000-000000000000') returning id \gset pu_
insert into projetos (nome, data_inicio, moeda, organizacao_id) values
  ('A em real',  '2026-01-01', 'BRL', 'a1000000-0000-0000-0000-000000000000') returning id \gset pb_
insert into projetos (nome, data_inicio, moeda) values ('A solto', '2026-01-01', 'USD') returning id \gset ps_
update projetos set organizacao_id = null where id = :'ps_id';

insert into investimentos (projeto_id, item, categoria, quantidade, valor_unitario, data)
values (:'pu_id', 'Balança', 'infraestrutura', 1, 1000, '2026-01-10');
-- receita 10 × 100 = 1000; custo 10 × 20 + 1000 × 10 % = 300; lançada no mês corrente
insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, custo_unitario, impostos_pct, data)
values (:'pu_id', 'venda_produto', 10, 'Toneladas', 100, 20, 10, current_date);
-- venda com data no mês que vem: entra na receita, mas NÃO na receita do mês
insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, data)
values (:'pu_id', 'venda_produto', 1, 'Toneladas', 500, (date_trunc('month', current_date) + interval '1 month')::date);
insert into despesas (projeto_id, descricao, categoria, valor, data)
values (:'pu_id', 'Folha', 'pessoal', 50, '2026-02-01');
-- BRL: receita 5 × 200 = 1000, fora do mês corrente
insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, data)
values (:'pb_id', 'venda_produto', 5, 'Toneladas', 200, '2020-01-15');
-- projeto solto: não pode aparecer em lugar nenhum do painel
insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, data)
values (:'ps_id', 'venda_produto', 1, 'Toneladas', 999, current_date);

insert into clientes (organizacao_id, nome, ativo) values
  ('a1000000-0000-0000-0000-000000000000', 'Cliente 1', true),
  ('a1000000-0000-0000-0000-000000000000', 'Cliente 2', true),
  ('a1000000-0000-0000-0000-000000000000', 'Cliente 3', false);
insert into fornecedores (organizacao_id, nome) values ('a1000000-0000-0000-0000-000000000000', 'Transportadora');
insert into commodities (organizacao_id, nome) values
  ('a1000000-0000-0000-0000-000000000000', 'Minério de ferro'),
  ('a1000000-0000-0000-0000-000000000000', 'Manganês');

-- Empresa B: um projeto em USD que a empresa A não pode somar.
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
insert into projetos (nome, data_inicio, moeda, organizacao_id) values
  ('B', '2026-01-01', 'USD', 'b1000000-0000-0000-0000-000000000000') returning id \gset pbb_
insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, data)
values (:'pbb_id', 'venda_produto', 1, 'Toneladas', 777, current_date);

-- Empresa D: só opera em real.
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-00000000000d';
insert into projetos (nome, data_inicio, moeda, organizacao_id) values
  ('D', '2026-01-01', 'BRL', 'd1000000-0000-0000-0000-000000000000') returning id \gset pd_
insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, data)
values (:'pd_id', 'venda_produto', 2, 'Toneladas', 50, '2026-03-01');

set local role authenticated;

-- 1. ADM da empresa A: uma linha por moeda, só projetos da empresa, as três saídas somadas.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$ declare n int; u record; b record; begin
  select count(*) into n from painel_empresa('a1000000-0000-0000-0000-000000000000');
  if n <> 2 then raise exception 'empresa A: esperava 2 linhas (USD e BRL), veio %', n; end if;
  select * into u from painel_empresa('a1000000-0000-0000-0000-000000000000') where moeda = 'USD';
  select * into b from painel_empresa('a1000000-0000-0000-0000-000000000000') where moeda = 'BRL';
  if (u.clientes, u.clientes_ativos, u.fornecedores, u.commodities, u.projetos) <> (3, 2, 1, 2, 2) then
    raise exception 'contagens erradas: % % % % %', u.clientes, u.clientes_ativos, u.fornecedores, u.commodities, u.projetos; end if;
  if (b.clientes, b.projetos) <> (3, 2) then raise exception 'as contagens devem repetir em toda linha'; end if;
  if (u.investimento, u.receita, u.custo_vendas, u.despesas) <> (1000, 1500, 300, 50) then
    raise exception 'parcelas USD erradas: inv % rec % custo % desp %', u.investimento, u.receita, u.custo_vendas, u.despesas; end if;
  if u.saida <> u.investimento + u.custo_vendas + u.despesas or u.saida <> 1350 then
    raise exception 'saída deve ser investimento + custo das vendas + despesas, veio %', u.saida; end if;
  if u.saldo <> u.receita - u.saida or u.saldo <> 150 then raise exception 'saldo errado: %', u.saldo; end if;
  if (u.receita_mes, u.vendas_qtd) <> (1000, 2) then
    raise exception 'USD: receita do mês % (venda futura não entra) e vendas %', u.receita_mes, u.vendas_qtd; end if;
  if (b.receita, b.saida, b.saldo, b.receita_mes, b.vendas_qtd) <> (1000, 0, 1000, 0, 1) then
    raise exception 'BRL errado: rec % saída % saldo % mês % qtd %', b.receita, b.saida, b.saldo, b.receita_mes, b.vendas_qtd; end if;
  raise notice 'OK painel da empresa: por moeda, três saídas, só projetos da empresa, mês sem venda futura';
end $$;

-- 2. Empresa sem projeto: UMA linha em USD, zerada — nunca zero linhas (tela em branco).
set local request.jwt.claim.sub = 'c0000000-0000-0000-0000-00000000000c';
do $$ declare n int; r record; begin
  select count(*) into n from painel_empresa('c1000000-0000-0000-0000-000000000000');
  if n <> 1 then raise exception 'empresa sem projeto: esperava 1 linha, veio %', n; end if;
  select * into r from painel_empresa('c1000000-0000-0000-0000-000000000000');
  if r.moeda <> 'USD' or r.receita <> 0 or r.saida <> 0 or r.projetos <> 0 then raise exception 'linha vazia errada'; end if;
  raise notice 'OK empresa sem projeto devolve uma linha zerada';
end $$;

-- 3. Empresa que só opera em BRL: só a linha BRL. Um bloco USD todo zerado seria um
--    "zero que parece número real" — justamente o que o painel promete não mostrar.
set local request.jwt.claim.sub = 'd0000000-0000-0000-0000-00000000000d';
do $$ declare n int; m public.moeda; begin
  select count(*), min(moeda) into n, m from painel_empresa('d1000000-0000-0000-0000-000000000000');
  if n <> 1 or m <> 'BRL' then raise exception 'empresa só em BRL: esperava só a linha BRL, veio % linha(s)', n; end if;
  raise notice 'OK empresa só em BRL não ganha linha USD zerada';
end $$;

-- 4. Quem não é ADM da empresa não vê o painel — nem o master (ele libera empresas, não lê dados delas).
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
do $$ begin
  perform painel_empresa('a1000000-0000-0000-0000-000000000000');
  raise exception 'DEVERIA falhar: ADM de outra empresa';
exception when insufficient_privilege then raise notice 'OK ADM de outra empresa é barrado'; end $$;
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
do $$ begin
  perform painel_empresa('a1000000-0000-0000-0000-000000000000');
  raise exception 'DEVERIA falhar: master';
exception when insufficient_privilege then raise notice 'OK master não lê o painel de empresa'; end $$;
set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-00000000000f';
do $$ begin
  perform painel_empresa('a1000000-0000-0000-0000-000000000000');
  raise exception 'DEVERIA falhar: estranho';
exception when insufficient_privilege then raise notice 'OK estranho é barrado'; end $$;
reset request.jwt.claim.sub;
do $$ begin
  perform painel_empresa('a1000000-0000-0000-0000-000000000000');
  raise exception 'DEVERIA falhar: sem login';
exception when insufficient_privilege then raise notice 'OK sem login é barrado'; end $$;

-- 5. Empresa suspensa: o painel não fura a trava — o sócio que não é dono deixa de somar os projetos.
set local role postgres;
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
update organizacoes set ativa = false where id = 'a1000000-0000-0000-0000-000000000000';
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000005a';
do $$ declare r record; begin
  select * into r from painel_empresa('a1000000-0000-0000-0000-000000000000') order by moeda limit 1;
  if r.projetos <> 0 or r.receita <> 0 then
    raise exception 'suspensa: o sócio não deveria somar projeto (projetos %, receita %)', r.projetos, r.receita; end if;
  raise notice 'OK painel respeita a suspensão da empresa';
end $$;

rollback;
