-- Testes da migration 0006 (executar com psql -v ON_ERROR_STOP=1). Roda em transação e desfaz tudo.
begin;

insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'dono@exemplo.com',       now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@exemplo.com',      now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'manager@exemplo.com',    now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'escritorio@exemplo.com', now()),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'novato@exemplo.com',     now());

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into projetos (nome, data_inicio, moeda, participacao_pct)
values ('Papéis', '2026-01-01', 'USD', 100) returning id \gset p_
insert into investimentos (projeto_id, item, categoria, quantidade, valor_unitario, data)
values (:'p_id', 'Barcaça', 'logistica', 1, 1000000, '2026-01-10');
insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, data)
values (:'p_id', 'venda_produto', 100, 'Toneladas', 80, '2026-03-01') returning id \gset v_
insert into despesas (projeto_id, descricao, categoria, valor, data)
values (:'p_id', 'Diesel', 'combustivel', 5000, '2026-03-05');

insert into projeto_membros (projeto_id, email, papel) values
  (:'p_id', 'admin@exemplo.com',      'admin'),
  (:'p_id', 'manager@exemplo.com',    'manager'),
  (:'p_id', 'escritorio@exemplo.com', 'escritorio');

-- ---------------------------------------------------------------------------
-- ADMIN: enxerga e mexe em tudo, inclusive investimentos
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
do $$ declare n int; begin
  if papel_no_projeto((select id from projetos limit 1)) <> 'admin' then raise exception 'papel do admin errado'; end if;
  select count(*) into n from investimentos; if n <> 1 then raise exception 'admin deveria ver investimento'; end if;
  insert into investimentos (projeto_id, item, categoria, quantidade, valor_unitario, data)
  select id, 'Guindaste', 'infraestrutura', 1, 50000, '2026-02-01' from projetos;
  update projetos set descricao = 'admin pode editar a estrutura';
  raise notice 'OK admin';
end $$;

-- ---------------------------------------------------------------------------
-- MANAGER: vê entradas e saídas, NÃO vê investimentos, lança e corrige sem PIN
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
do $$ declare n int; begin
  if papel_no_projeto((select id from projetos limit 1)) <> 'manager' then raise exception 'papel do manager errado'; end if;
  select count(*) into n from projetos;      if n <> 1 then raise exception 'manager deveria ver o projeto'; end if;
  select count(*) into n from vendas;        if n <> 1 then raise exception 'manager deveria ver vendas'; end if;
  select count(*) into n from despesas;      if n <> 1 then raise exception 'manager deveria ver despesas'; end if;
  select count(*) into n from investimentos; if n <> 0 then raise exception 'manager NÃO pode ver investimentos (viu %)', n; end if;
  select count(*) into n from estimativas_ia; if n <> 0 then raise exception 'manager NÃO pode ver estimativas de IA'; end if;
  raise notice 'OK manager enxerga entrada/saída e não enxerga investimento';
end $$;

-- o fluxo mensal do manager não traz o capex (fluxo_mensal é security invoker)
do $$ declare r record; begin
  select * into r from fluxo_mensal((select id from projetos limit 1)) where mes = '2026-01-01';
  if r.investimento <> 0 then raise exception 'investimento vazou no fluxo do manager: %', r.investimento; end if;
  select * into r from fluxo_mensal((select id from projetos limit 1)) where mes = '2026-03-01';
  if r.despesas <> 5000 then raise exception 'manager deveria ver a despesa no fluxo'; end if;
  raise notice 'OK fluxo do manager sem capex';
end $$;

do $$ declare n int; begin
  insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, data)
  select id, 'servicos', 10, 'Horas', 100, '2026-04-01' from projetos;
  update vendas set preco_unitario = 85 where data = '2026-03-01'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'manager deveria corrigir venda sem PIN'; end if;
  delete from vendas where data = '2026-04-01'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'manager deveria excluir venda sem PIN'; end if;
  raise notice 'OK manager lança, corrige e exclui sem PIN';
end $$;

savepoint m1;
do $$ begin
  insert into investimentos (projeto_id, item, categoria, quantidade, valor_unitario, data)
  select id, 'Proibido', 'logistica', 1, 1, '2026-02-01' from projetos;
  raise exception 'DEVERIA falhar: manager não lança investimento';
exception when insufficient_privilege then raise notice 'OK manager bloqueado em investimentos'; end $$;
rollback to savepoint m1;

savepoint m2;
do $$ begin
  insert into projeto_membros (projeto_id, email, papel) select id, 'invasor@exemplo.com', 'admin' from projetos;
  raise exception 'DEVERIA falhar: manager não convida';
exception when insufficient_privilege then raise notice 'OK manager não gere acessos'; end $$;
rollback to savepoint m2;

-- ---------------------------------------------------------------------------
-- ESCRITÓRIO: lança, mas não altera nem exclui sem PIN
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
do $$ declare n int; begin
  if papel_no_projeto((select id from projetos limit 1)) <> 'escritorio' then raise exception 'papel do escritório errado'; end if;
  insert into despesas (projeto_id, descricao, categoria, valor, data)
  select id, 'Pedágio', 'outros', 300, '2026-03-10' from projetos;
  select count(*) into n from despesas; if n <> 2 then raise exception 'escritório deveria lançar despesa'; end if;
  select count(*) into n from investimentos; if n <> 0 then raise exception 'escritório não vê investimentos'; end if;
  raise notice 'OK escritório lança';
end $$;

do $$ declare n int; begin
  update despesas set valor = 1 where descricao = 'Pedágio'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'escritório NÃO deveria alterar sem PIN (% linhas)', n; end if;
  delete from despesas where descricao = 'Pedágio';           get diagnostics n = row_count;
  if n <> 0 then raise exception 'escritório NÃO deveria excluir sem PIN (% linhas)', n; end if;
  raise notice 'OK escritório travado sem PIN';
end $$;

-- ---------------------------------------------------------------------------
-- PIN
-- ---------------------------------------------------------------------------
savepoint pin0;
do $$ begin
  perform definir_pin((select id from projetos limit 1), 'segredo123');
  raise exception 'DEVERIA falhar: escritório não define PIN';
exception when insufficient_privilege then raise notice 'OK só admin define PIN'; end $$;
rollback to savepoint pin0;

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
savepoint pin1;
do $$ begin
  perform definir_pin((select id from projetos limit 1), '123');
  raise exception 'DEVERIA falhar: PIN curto';
exception when check_violation then raise notice 'OK PIN mínimo de 6'; end $$;
rollback to savepoint pin1;

select definir_pin(:'p_id', 'segredo123') \gset ignore_
do $$ begin
  if not tem_pin((select id from projetos limit 1)) then raise exception 'PIN deveria existir'; end if;
  raise notice 'OK PIN cadastrado';
end $$;

-- o hash não sai por consulta direta (RLS sem policy nenhuma)
do $$ declare n int; begin
  select count(*) into n from projeto_pin;
  if n <> 0 then raise exception 'o hash do PIN vazou por select direto'; end if;
  raise notice 'OK hash do PIN inacessível';
end $$;

set local request.jwt.claim.sub = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
do $$ declare n int; begin
  if autorizar_pin((select id from projetos limit 1), 'errado') then raise exception 'PIN errado não pode autorizar'; end if;
  if tem_autorizacao((select id from projetos limit 1)) then raise exception 'não deveria haver janela aberta'; end if;
  update despesas set valor = 1 where descricao = 'Pedágio'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'PIN errado não libera alteração'; end if;
  raise notice 'OK PIN errado não libera nada';
end $$;

do $$ declare n int; begin
  if not autorizar_pin((select id from projetos limit 1), 'segredo123') then raise exception 'PIN certo deveria autorizar'; end if;
  if not tem_autorizacao((select id from projetos limit 1)) then raise exception 'janela deveria estar aberta'; end if;
  update despesas set valor = 350 where descricao = 'Pedágio'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'com PIN o escritório deveria alterar (% linhas)', n; end if;
  delete from despesas where descricao = 'Pedágio';           get diagnostics n = row_count;
  if n <> 1 then raise exception 'com PIN o escritório deveria excluir'; end if;
  raise notice 'OK PIN libera alterar e excluir';
end $$;

-- janela expirada não vale
savepoint pin2;
do $$ declare n int; begin
  update autorizacoes set expira_em = now() - interval '1 minute';
  if tem_autorizacao((select id from projetos limit 1)) then raise exception 'janela expirada não deveria valer'; end if;
  raise notice 'OK janela expira';
end $$;
rollback to savepoint pin2;

-- trava depois de 5 erros
savepoint pin3;
do $$ declare i int; begin
  delete from autorizacoes;
  for i in 1..5 loop
    perform autorizar_pin((select id from projetos limit 1), 'errado');
  end loop;
  begin
    perform autorizar_pin((select id from projetos limit 1), 'segredo123');
    raise exception 'DEVERIA ter travado após 5 erros';
  exception when check_violation then raise notice 'OK trava após 5 tentativas'; end;
end $$;
rollback to savepoint pin3;

-- ---------------------------------------------------------------------------
-- CONVITE POR LINK
-- ---------------------------------------------------------------------------
savepoint c0;
do $$ begin
  perform criar_convite((select id from projetos limit 1), repeat('t', 32), 'admin', 7, 1);
  raise exception 'DEVERIA falhar: escritório não cria convite';
exception when insufficient_privilege then raise notice 'OK só admin cria convite'; end $$;
rollback to savepoint c0;

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select criar_convite(:'p_id', 'token-de-convite-com-tamanho-ok-1', 'manager', 7, 1) \gset conv_

-- o token em texto não fica no banco
do $$ declare n int; begin
  select count(*) into n from convites where token_hash = 'token-de-convite-com-tamanho-ok-1';
  if n <> 0 then raise exception 'o token cru foi guardado'; end if;
  raise notice 'OK convite guarda só o hash';
end $$;

set local request.jwt.claim.sub = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
do $$ declare v uuid; n int; begin
  select count(*) into n from projetos; if n <> 0 then raise exception 'novato não deveria ver nada ainda'; end if;
  v := aceitar_convite('token-de-convite-com-tamanho-ok-1');
  if v is null then raise exception 'convite válido deveria ser aceito'; end if;
  select count(*) into n from projetos; if n <> 1 then raise exception 'novato deveria ver o projeto'; end if;
  if papel_no_projeto(v) <> 'manager' then raise exception 'papel do convite não foi aplicado'; end if;
  select count(*) into n from investimentos; if n <> 0 then raise exception 'manager via link não pode ver investimento'; end if;
  raise notice 'OK convite por link entrega o papel certo';
end $$;

-- convite de uso único não serve duas vezes
insert into auth.users (id, email, email_confirmed_at)
values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'outro@exemplo.com', now());
set local request.jwt.claim.sub = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
do $$ begin
  if aceitar_convite('token-de-convite-com-tamanho-ok-1') is not null then
    raise exception 'convite de uso único foi reaproveitado';
  end if;
  raise notice 'OK convite esgotado';
end $$;

-- token inexistente, convite revogado e convite vencido
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select criar_convite(:'p_id', 'token-revogado-com-tamanho-ok-22', 'escritorio', 7, 5) \gset rev_
update convites set revogado = true where id = :'rev_criar_convite';
select criar_convite(:'p_id', 'token-vencido-com-tamanho-ok-333', 'escritorio', 7, 5) \gset old_
update convites set expira_em = now() - interval '1 day' where id = :'old_criar_convite';

set local request.jwt.claim.sub = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
do $$ begin
  if aceitar_convite('nao-existe-esse-token-aqui-nenhum') is not null then raise exception 'token inexistente passou'; end if;
  if aceitar_convite('token-revogado-com-tamanho-ok-22')  is not null then raise exception 'convite revogado passou'; end if;
  if aceitar_convite('token-vencido-com-tamanho-ok-333')  is not null then raise exception 'convite vencido passou'; end if;
  raise notice 'OK convite inválido, revogado e vencido são recusados';
end $$;

-- e-mail não confirmado não aceita convite
insert into auth.users (id, email, email_confirmed_at)
values ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'semconfirmar@exemplo.com', null);
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select criar_convite(:'p_id', 'token-para-nao-confirmado-ok-444', 'escritorio', 7, 5) \gset nc_
set local request.jwt.claim.sub = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
do $$ begin
  begin
    perform aceitar_convite('token-para-nao-confirmado-ok-444');
    raise exception 'DEVERIA falhar: e-mail não confirmado';
  exception when check_violation then raise notice 'OK e-mail não confirmado não entra por link'; end;
end $$;

rollback;
