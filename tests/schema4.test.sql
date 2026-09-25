-- Testes da migration 0004 (executar com psql -v ON_ERROR_STOP=1). Roda em transação e desfaz tudo.
begin;

-- dono, sócio leitor, sócio editor, um e-mail não confirmado e um estranho
insert into auth.users (id, email, email_confirmed_at) values
  ('11111111-1111-1111-1111-111111111111', 'dono@exemplo.com',      now()),
  ('22222222-2222-2222-2222-222222222222', 'leitor@exemplo.com',    now()),
  ('33333333-3333-3333-3333-333333333333', 'editor@exemplo.com',    now()),
  ('44444444-4444-4444-4444-444444444444', 'naoconfirmado@exemplo.com', null),
  ('55555555-5555-5555-5555-555555555555', 'estranho@exemplo.com',  now());

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
values ('JV com sócios', '2026-01-01', 'USD', 60) returning id \gset p_
insert into investimentos (projeto_id, item, categoria, quantidade, valor_unitario, data)
values (:'p_id', 'Barcaça', 'logistica', 1, 500000, '2026-01-10');

-- o dono convida: leitor, editor e um e-mail ainda não confirmado (com MAIÚSCULAS e espaço)
insert into projeto_membros (projeto_id, email, papel) values
  (:'p_id', '  Leitor@Exemplo.com ', 'leitor'),
  (:'p_id', 'editor@exemplo.com',    'editor'),
  (:'p_id', 'naoconfirmado@exemplo.com', 'editor');

do $$ begin
  if (select papel_no_projeto((select id from projetos limit 1))) <> 'dono' then raise exception 'dono deveria ser dono'; end if;
  raise notice 'OK papel do dono';
end $$;

-- e-mail duplicado no mesmo projeto não entra (normalização lower/trim)
savepoint s0;
do $$ begin
  insert into projeto_membros (projeto_id, email, papel) select id, 'LEITOR@exemplo.com', 'editor' from projetos;
  raise exception 'DEVERIA falhar: e-mail repetido no projeto';
exception when unique_violation then raise notice 'OK e-mail único por projeto (normalizado)'; end $$;
rollback to savepoint s0;

-- ---------------------------------------------------------------------------
-- LEITOR: enxerga tudo, não escreve nada
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ declare n int; begin
  select count(*) into n from projetos;      if n <> 1 then raise exception 'leitor deveria ver 1 projeto, viu %', n; end if;
  select count(*) into n from investimentos; if n <> 1 then raise exception 'leitor deveria ver 1 investimento, viu %', n; end if;
  select count(*) into n from projeto_membros; if n <> 3 then raise exception 'leitor deveria ver os 3 membros, viu %', n; end if;
  if (select papel_no_projeto((select id from projetos limit 1))) <> 'leitor' then raise exception 'papel errado para o leitor'; end if;
  if (select count(*) from fluxo_mensal((select id from projetos limit 1))) = 0 then raise exception 'leitor deveria ver o fluxo mensal'; end if;
  raise notice 'OK leitor enxerga o projeto';
end $$;

savepoint s1;
do $$ begin
  insert into investimentos (projeto_id, item, categoria, quantidade, valor_unitario, data)
  select id, 'Proibido', 'logistica', 1, 1, '2026-02-01' from projetos;
  raise exception 'DEVERIA falhar: leitor não lança investimento';
exception when insufficient_privilege then raise notice 'OK leitor bloqueado no insert'; end $$;
rollback to savepoint s1;

do $$ declare n int; begin
  update investimentos set item = 'Alterado';           get diagnostics n = row_count;
  if n <> 0 then raise exception 'leitor não deveria alterar (% linhas)', n; end if;
  delete from investimentos;                            get diagnostics n = row_count;
  if n <> 0 then raise exception 'leitor não deveria excluir (% linhas)', n; end if;
  update projetos set nome = 'Renomeado pelo leitor';   get diagnostics n = row_count;
  if n <> 0 then raise exception 'leitor não deveria renomear o projeto'; end if;
  raise notice 'OK leitor bloqueado em update/delete';
end $$;

savepoint s2;
do $$ begin
  insert into projeto_membros (projeto_id, email, papel) select id, 'invasor@exemplo.com', 'editor' from projetos;
  raise exception 'DEVERIA falhar: leitor não convida ninguém';
exception when insufficient_privilege then raise notice 'OK leitor não gere membros'; end $$;
rollback to savepoint s2;

-- ---------------------------------------------------------------------------
-- EDITOR: lança e altera movimentações, mas não mexe no projeto nem nos membros
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$ declare n int; begin
  if (select papel_no_projeto((select id from projetos limit 1))) <> 'editor' then raise exception 'papel errado para o editor'; end if;
  insert into investimentos (projeto_id, item, categoria, quantidade, valor_unitario, data)
  select id, 'Empurrador', 'logistica', 1, 400000, '2026-02-01' from projetos;
  update investimentos set valor_unitario = 450000 where item = 'Empurrador'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'editor deveria alterar o próprio lançamento'; end if;
  insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, data)
  select id, 'venda_produto', 100, 'Toneladas', 90, '2026-03-01' from projetos;
  raise notice 'OK editor lança e altera';
end $$;

do $$ declare n int; begin
  update projetos set nome = 'Renomeado pelo editor'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'editor não deveria renomear o projeto'; end if;
  raise notice 'OK editor não mexe no projeto';
end $$;

-- a trava de 100 % tem de valer também para o editor (fn_validar_participacao é
-- security definer justamente por causa do "for update" na linha do projeto)
insert into participantes (projeto_id, nome, tipo, percentual) select id, 'Sócio A', 'socio', 40 from projetos;
savepoint s3;
do $$ begin
  insert into participantes (projeto_id, nome, tipo, percentual) select id, 'Sócio B', 'socio', 1 from projetos;
  raise exception 'DEVERIA falhar: 60 (dono) + 40 + 1 > 100';
exception when check_violation then raise notice 'OK trava de 100%% vale para o editor: %', sqlerrm; end $$;
rollback to savepoint s3;

-- ---------------------------------------------------------------------------
-- E-MAIL NÃO CONFIRMADO: convidado como editor, mas sem acesso nenhum
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
do $$ declare n int; begin
  if public.email_confirmado() is not null then raise exception 'e-mail não confirmado não deveria resolver'; end if;
  select count(*) into n from projetos; if n <> 0 then raise exception 'sem confirmação não pode ver projeto'; end if;
  select count(*) into n from investimentos; if n <> 0 then raise exception 'sem confirmação não pode ver investimentos'; end if;
  if (select papel_no_projeto((select id from projetos limit 1))) is not null then raise exception 'não deveria ter papel'; end if;
  raise notice 'OK e-mail não confirmado fica de fora';
end $$;

-- ---------------------------------------------------------------------------
-- ESTRANHO: não foi convidado
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$ declare n int; begin
  select count(*) into n from projetos;        if n <> 0 then raise exception 'RLS projetos vazou'; end if;
  select count(*) into n from investimentos;   if n <> 0 then raise exception 'RLS investimentos vazou'; end if;
  select count(*) into n from vendas;          if n <> 0 then raise exception 'RLS vendas vazou'; end if;
  select count(*) into n from projeto_membros; if n <> 0 then raise exception 'RLS membros vazou'; end if;
  raise notice 'OK estranho não enxerga nada';
end $$;

-- ---------------------------------------------------------------------------
-- DONO: remove o acesso e o ex-membro perde tudo na hora
-- ---------------------------------------------------------------------------
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
delete from projeto_membros where email_normalizado = 'editor@exemplo.com';
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$ declare n int; begin
  select count(*) into n from projetos; if n <> 0 then raise exception 'acesso deveria ter sido revogado'; end if;
  raise notice 'OK acesso revogado';
end $$;

-- cascata: excluir o projeto leva os membros junto
reset role;
delete from projetos;
do $$ declare n int; begin
  select count(*) into n from projeto_membros; if n <> 0 then raise exception 'cascata de membros falhou'; end if;
  raise notice 'OK cascata de membros';
end $$;

rollback;
