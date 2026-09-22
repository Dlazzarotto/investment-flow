-- Testes da migration 0003 (executar com psql -v ON_ERROR_STOP=1). Roda em transação e desfaz tudo.
-- A concorrência em si precisa de duas sessões (roteiro no fim do arquivo); aqui garantimos
-- que a função continua validando e que o lock não quebra o fluxo normal.
begin;
insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111') on conflict do nothing;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into projetos (nome, data_inicio, moeda, participacao_pct)
values ('Lock 100', '2026-01-01', 'USD', 50) returning id \gset p_

-- a função agora trava a linha do projeto; o caminho feliz continua igual
insert into participantes (projeto_id, nome, tipo, percentual) values (:'p_id', 'Sócio A', 'socio', 30);
insert into participantes (projeto_id, nome, tipo, percentual) values (:'p_id', 'Sócio B', 'socio', 20);
do $$ declare v numeric; begin
  select participacao_pct + (select coalesce(sum(percentual), 0) from participantes) into v from projetos;
  if v <> 100 then raise exception 'esperava total 100, veio %', v; end if;
  raise notice 'OK soma 100 aceita';
end $$;

-- ultrapassar continua bloqueado (mesma mensagem que app/actions/erros.ts procura)
savepoint s1;
do $$ begin
  insert into participantes (projeto_id, nome, tipo, percentual) select id, 'Extra', 'socio', 0.01 from projetos;
  raise exception 'DEVERIA ter falhado: soma > 100';
exception when check_violation then
  if sqlerrm not like '%ultrapassa 100%' then raise exception 'mensagem mudou: %', sqlerrm; end if;
  raise notice 'OK trava 100%% preservada: %', sqlerrm;
end $$;
rollback to savepoint s1;

-- update do dono também revalida
savepoint s2;
do $$ begin
  update projetos set participacao_pct = 51;
  raise exception 'DEVERIA ter falhado: dono 51 + 50 > 100';
exception when check_violation then raise notice 'OK trava no update do dono'; end $$;
rollback to savepoint s2;

-- remover participante libera espaço
delete from participantes where nome = 'Sócio B';
update projetos set participacao_pct = 70;
do $$ declare v numeric; begin
  select participacao_pct into v from projetos;
  if v <> 70 then raise exception 'update deveria ter passado'; end if;
  raise notice 'OK espaço liberado após remoção';
end $$;

rollback;

-- ---------------------------------------------------------------------------
-- Concorrência (manual, duas sessões psql no mesmo banco):
--   Sessão A: begin; insert into participantes (projeto_id, nome, tipo, percentual)
--               values ('<projeto>', 'A', 'socio', 30);   -- não commitar ainda
--   Sessão B: begin; insert into participantes (projeto_id, nome, tipo, percentual)
--               values ('<projeto>', 'B', 'socio', 30);   -- deve FICAR ESPERANDO
--   Sessão A: commit;
--   Sessão B: com dono 50 %, deve falhar com "ultrapassa 100" (antes de 0003 as duas passavam).
-- ---------------------------------------------------------------------------
