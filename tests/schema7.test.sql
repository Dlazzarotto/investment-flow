-- Testes da 0007 (psql -v ON_ERROR_STOP=1). Roda em transação e desfaz tudo.
-- Usuários: D (dono), S (sócio da organização), I (investidor por e-mail), X (estranho).
begin;
insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'dono@x.com',    now()),
  ('22222222-2222-2222-2222-222222222222', 'socio@x.com',   now()),
  ('33333333-3333-3333-3333-333333333333', 'invest@x.com',  now()),
  ('44444444-4444-4444-4444-444444444444', 'fora@x.com',    now())
on conflict do nothing;

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

-- bug da 0004: criar projeto com RETURNING (como a action faz) tem que funcionar
insert into projetos (nome, data_inicio, moeda) values ('Retorno', '2026-01-01', 'USD') returning id \gset r_
do $$ begin raise notice 'OK insert com RETURNING em projetos (bug da 0004 corrigido)'; end $$;
delete from projetos where nome = 'Retorno';

-- organização criada pelo dono, com o sócio S
\set org 0f000000-0000-0000-0000-000000000000
insert into organizacao_membros (organizacao_id, email) values (:'org', 'Socio@X.com');

insert into projetos (nome, data_inicio, moeda, tipo_parceria, participacao_pct, organizacao_id)
values ('Mineração Norte', '2026-01-01', 'USD', 'joint_venture', 40, :'org') returning id \gset p_
insert into projetos (nome, data_inicio, moeda) values ('Projeto Solto', '2026-01-01', 'USD') returning id \gset q_
-- criado por um sócio, nasce vinculado à organização; o dono desvincula explicitamente
do $$ begin
  if (select organizacao_id from projetos where nome = 'Projeto Solto') is null then raise exception 'deveria nascer vinculado à org'; end if;
  raise notice 'OK projeto novo nasce na organização do criador';
end $$;
update projetos set organizacao_id = null where nome = 'Projeto Solto';

insert into participantes (projeto_id, nome, tipo, percentual, email) values (:'p_id', 'Fundo Alfa', 'investidor', 30, 'INVEST@x.com') returning id \gset pa_
insert into participantes (projeto_id, nome, tipo, percentual) values (:'p_id', 'Mineradora B', 'parceiro_jv', 30) returning id \gset pb_
insert into investimentos (projeto_id, item, categoria, quantidade, valor_unitario, data) values (:'p_id', 'Barcaças', 'logistica', 2, 500000, '2026-01-10');
insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, data) values (:'p_id', 'venda_produto', 10000, 'Toneladas', 90, '2026-03-01');
insert into despesas (projeto_id, descricao, categoria, valor, data) values (:'p_id', 'Folha', 'pessoal', 100000, '2026-02-01');
insert into aportes (projeto_id, participante_id, tipo, descricao, valor, data) values
  (:'p_id', :'pa_id', 'dinheiro',   'Aporte inicial',   300000, '2026-01-05'),
  (:'p_id', :'pb_id', 'maquinario', 'Escavadeira CAT',  250000, '2026-01-15');

-- trava: aporte de participante de outro projeto
savepoint s1;
do $$ begin
  insert into aportes (projeto_id, participante_id, tipo, descricao, valor, data)
  select (select id from projetos where nome = 'Projeto Solto'), (select id from participantes where nome = 'Fundo Alfa'), 'outro', 'x', 1, '2026-01-01';
  raise exception 'DEVERIA falhar: participante de outro projeto';
exception when check_violation then raise notice 'OK trava participante/projeto'; end $$;
rollback to savepoint s1;

-- dono: resumo
do $$ declare r record; begin
  select * into r from resumo_projeto((select id from projetos where nome = 'Mineração Norte'));
  if r.investimento_total <> 1000000 or r.receita_total <> 900000 or r.despesas_total <> 100000 or r.saldo <> -200000 or r.aportes_total <> 550000
    then raise exception 'resumo errado: %', r; end if;
  raise notice 'OK resumo_projeto (dono)';
end $$;

-- ===== S: sócio da organização, sem convite no projeto =====
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ declare n int; p text; begin
  p := papel_no_projeto((select id from projetos where nome = 'Mineração Norte'));
  if p <> 'admin' then raise exception 'sócio deveria ser admin, é %', p; end if;
  select count(*) into n from investimentos; if n <> 1 then raise exception 'sócio deveria ver investimentos'; end if;
  select count(*) into n from aportes; if n <> 2 then raise exception 'sócio deveria ver os 2 aportes'; end if;
  select count(*) into n from projetos where nome = 'Projeto Solto'; if n <> 0 then raise exception 'sócio NÃO deveria ver projeto fora da organização'; end if;
  raise notice 'OK sócio da organização = admin nos projetos vinculados, e só neles';
end $$;
-- sócio lança aporte (admin pode)
insert into aportes (projeto_id, participante_id, tipo, descricao, valor, data)
select id, (select id from participantes where nome = 'Mineradora B'), 'credito', 'Linha de crédito', 100000, '2026-02-01' from projetos where nome = 'Mineração Norte';

-- ===== I: investidor só pelo e-mail no participante =====
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$ declare n int; p text; r record; begin
  p := papel_no_projeto((select id from projetos where nome = 'Mineração Norte'));
  if p <> 'investidor' then raise exception 'deveria ser investidor, é %', p; end if;
  select count(*) into n from projetos; if n <> 1 then raise exception 'investidor deveria ver 1 projeto, vê %', n; end if;
  select count(*) into n from participantes; if n <> 1 then raise exception 'investidor deveria ver só a própria linha, vê %', n; end if;
  select count(*) into n from aportes; if n <> 1 then raise exception 'investidor deveria ver só o próprio aporte, vê %', n; end if;
  select count(*) into n from investimentos; if n <> 0 then raise exception 'investidor NÃO vê investimentos'; end if;
  select count(*) into n from projeto_membros; if n <> 0 then raise exception 'investidor NÃO vê membros'; end if;
  select count(*) into n from vendas; if n <> 1 then raise exception 'investidor vê vendas (retorno)'; end if;
  select * into r from resumo_projeto((select id from projetos limit 1));
  if r.investimento_total <> 1000000 then raise exception 'resumo do investidor deveria trazer o total de investimento'; end if;
  select * into r from minha_carteira();
  if r.minha_pct <> 30 or r.meus_aportes <> 300000 or r.saldo_atribuivel <> round(-200000 * 0.30, 2) then raise exception 'carteira errada: %', r; end if;
  raise notice 'OK investidor: papel, visibilidade restrita, resumo e carteira';
end $$;
savepoint s2;
do $$ declare n int; begin
  insert into aportes (projeto_id, participante_id, tipo, descricao, valor, data)
  select projeto_id, id, 'dinheiro', 'tentativa', 1, '2026-01-01' from participantes;
  raise exception 'DEVERIA falhar: investidor não lança aporte';
exception when insufficient_privilege then raise notice 'OK investidor não lança (RLS)';
end $$;
rollback to savepoint s2;
savepoint s3;
do $$ begin
  insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, data) select id, 'outros', 1, 'Toneladas', 1, '2026-01-01' from projetos;
  raise exception 'DEVERIA falhar: investidor não lança venda';
exception when insufficient_privilege then raise notice 'OK investidor não lança venda (RLS)';
end $$;
rollback to savepoint s3;

-- ===== X: estranho =====
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
do $$ declare n int; begin
  select count(*) into n from projetos; if n <> 0 then raise exception 'estranho vê projetos'; end if;
  select count(*) into n from aportes;  if n <> 0 then raise exception 'estranho vê aportes'; end if;
  select count(*) into n from minha_carteira(); if n <> 0 then raise exception 'estranho tem carteira'; end if;
  if minha_organizacao() is not null then raise exception 'estranho tem organização'; end if;
  raise notice 'OK estranho não vê nada';
end $$;

-- último sócio não sai
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
delete from organizacao_membros where email_normalizado = 'socio@x.com';
savepoint s4;
do $$ begin
  delete from organizacao_membros;
  raise exception 'DEVERIA falhar: último sócio';
exception when check_violation then raise notice 'OK último sócio não sai'; end $$;
rollback to savepoint s4;

rollback;
