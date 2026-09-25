begin;
insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222') on conflict do nothing;
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
insert into projetos (nome, data_inicio, moeda) values ('P', '2026-01-01', 'USD') returning id \gset p_
insert into estimativas_ia (projeto_id, item, moeda, valor_min, valor_medio, valor_max, modelo, criado_em)
values (:'p_id', ' Barcaça 2000t ', 'USD', 400000, 500000, 650000, 'm', now() - interval '1 day'),
       (:'p_id', 'barcaça 2000T',   'USD', 420000, 520000, 660000, 'm', now()),
       (:'p_id', 'Empurrador',      'USD', 1000000, 1200000, 1500000, 'm', now());
do $$ declare n int; v numeric; begin
  select count(*) into n from ultimas_estimativas((select id from projetos limit 1)); if n <> 2 then raise exception 'esperava 2 itens distintos, veio %', n; end if;
  select valor_medio into v from ultimas_estimativas((select id from projetos limit 1)) where item_normalizado = 'barcaça 2000t';
  if v <> 520000 then raise exception 'deveria trazer a mais recente (520000), veio %', v; end if;
  raise notice 'OK ultimas_estimativas (normalização + mais recente)';
end $$;
savepoint s1;
do $$ begin
  insert into estimativas_ia (projeto_id, item, moeda, valor_min, valor_medio, valor_max, modelo) select id, 'X', 'USD', 10, 5, 20, 'm' from projetos;
  raise exception 'DEVERIA falhar: min > medio';
exception when check_violation then raise notice 'OK check faixa min<=medio<=max'; end $$;
rollback to savepoint s1;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ declare n int; begin
  select count(*) into n from estimativas_ia; if n <> 0 then raise exception 'RLS estimativas vazou'; end if;
  select count(*) into n from ultimas_estimativas('00000000-0000-0000-0000-000000000000'); 
  raise notice 'OK RLS estimativas';
end $$;
rollback;
