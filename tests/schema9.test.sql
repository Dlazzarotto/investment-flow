-- Testes da 0018 — contratos (psql -v ON_ERROR_STOP=1). Roda em transação e desfaz tudo.
-- Usuários: A (ADM da empresa A), B (ADM da empresa B), M (master) e X (estranho).
begin;
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'adm@empresa-a.com', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'adm@empresa-b.com', now()),
  ('e0000000-0000-0000-0000-00000000000e', 'master@plataforma.com', now()),
  ('f0000000-0000-0000-0000-00000000000f', 'fora@x.com', now())
on conflict do nothing;
insert into plataforma_admins (email) values ('master@plataforma.com');
insert into organizacoes (id, nome, criado_por) values
  ('a1000000-0000-0000-0000-000000000000', 'Empresa A', 'a0000000-0000-0000-0000-00000000000a'),
  ('b1000000-0000-0000-0000-000000000000', 'Empresa B', 'b0000000-0000-0000-0000-00000000000b');
insert into organizacao_membros (organizacao_id, email) values
  ('a1000000-0000-0000-0000-000000000000', 'adm@empresa-a.com'),
  ('b1000000-0000-0000-0000-000000000000', 'adm@empresa-b.com');
insert into clientes (id, organizacao_id, nome, tipos) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'Comprador Shandong', '{comprador}'),
  ('a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000000', 'Mina Corumbá', '{vendedor}'),
  ('b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000000', 'Cliente da B', '{comprador}');
insert into commodities (id, organizacao_id, nome) values
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'Minério de ferro 62 %'),
  ('b3000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000000', 'Manganês');
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
insert into projetos (id, nome, data_inicio, moeda, organizacao_id) values
  ('b4000000-0000-0000-0000-000000000001', 'Projeto da B', '2026-01-01', 'USD', 'b1000000-0000-0000-0000-000000000000');

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';

-- 1. Venda como principal, preço fixo, LC com provisória; compra casada, por fórmula.
insert into contratos (organizacao_id, numero, contraparte_id, commodity_id, direcao, papel, modalidade,
                       volume, tolerancia_pct, incoterm, preco_fixo, forma_pagamento, pct_provisoria)
values ('a1000000-0000-0000-0000-000000000000', 'DSD-2026-001', 'a2000000-0000-0000-0000-000000000001',
        'a3000000-0000-0000-0000-000000000001', 'venda', 'principal', 'term', 600000, 10, 'CFR', 105.50, 'lc', 90);
insert into contratos (organizacao_id, contraparte_id, commodity_id, direcao, volume, tipo_preco, indice, premio,
                       periodo_cotacao, forma_pagamento, prazo_pagamento_dias)
values ('a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000002',
        'a3000000-0000-0000-0000-000000000001', 'compra', 600000, 'formula', 'Platts IODEX 62 % Fe CFR China', -8.5,
        'Média do mês do BL', 'tt_documentos', 5);
-- Agente: comissão por tonelada.
insert into contratos (organizacao_id, contraparte_id, commodity_id, papel, volume, preco_fixo, comissao_base, comissao_valor)
values ('a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
        'a3000000-0000-0000-0000-000000000001', 'agente', 50000, 98, 'por_unidade', 1.5);
do $$ declare n int; begin
  select count(*) into n from contratos; if n <> 3 then raise exception 'esperava 3 contratos, veio %', n; end if;
  if (select status from contratos where numero = 'DSD-2026-001') <> 'rascunho' then raise exception 'contrato nasce em rascunho'; end if;
  raise notice 'OK contrato de venda, de compra por fórmula e de agente';
end $$;

-- 2. Travas de regra.
do $$ begin
  insert into contratos (organizacao_id, contraparte_id, commodity_id, volume, tipo_preco)
  values ('a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 1, 'formula');
  raise exception 'DEVERIA falhar: fórmula sem índice';
exception when check_violation then raise notice 'OK fórmula exige índice'; end $$;
do $$ begin
  insert into contratos (organizacao_id, contraparte_id, commodity_id, volume)
  values ('a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 1);
  raise exception 'DEVERIA falhar: preço fixo sem preço';
exception when check_violation then raise notice 'OK preço fixo exige preço'; end $$;
do $$ begin
  insert into contratos (organizacao_id, contraparte_id, commodity_id, papel, volume, preco_fixo)
  values ('a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'agente', 1, 10);
  raise exception 'DEVERIA falhar: agente sem comissão';
exception when check_violation then raise notice 'OK agente exige comissão'; end $$;
do $$ begin
  insert into contratos (organizacao_id, contraparte_id, commodity_id, volume, preco_fixo, comissao_base, comissao_valor)
  values ('a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 1, 10, 'pct_valor', 2);
  raise exception 'DEVERIA falhar: principal com comissão';
exception when check_violation then raise notice 'OK principal não leva comissão no contrato'; end $$;
do $$ begin
  insert into contratos (organizacao_id, contraparte_id, commodity_id, papel, volume, preco_fixo, comissao_base, comissao_valor)
  values ('a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'agente', 1, 10, 'pct_valor', 150);
  raise exception 'DEVERIA falhar: comissão de 150 %%';
exception when check_violation then raise notice 'OK comissão percentual até 100 %%'; end $$;
do $$ begin
  insert into contratos (organizacao_id, contraparte_id, commodity_id, volume, preco_fixo, inicio_entregas, fim_entregas)
  values ('a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 1, 10, '2026-06-01', '2026-01-01');
  raise exception 'DEVERIA falhar: fim antes do início';
exception when check_violation then raise notice 'OK período de entregas coerente'; end $$;
do $$ begin
  insert into contratos (organizacao_id, numero, contraparte_id, commodity_id, volume, preco_fixo)
  values ('a1000000-0000-0000-0000-000000000000', ' dsd-2026-001 ', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 1, 10);
  raise exception 'DEVERIA falhar: número repetido';
exception when unique_violation then raise notice 'OK número do contrato único na empresa (sem caixa e espaços)'; end $$;

-- 3. Nada de outra empresa entra no contrato.
do $$ begin
  insert into contratos (organizacao_id, contraparte_id, commodity_id, volume, preco_fixo)
  values ('a1000000-0000-0000-0000-000000000000', 'b2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 1, 10);
  raise exception 'DEVERIA falhar: contraparte da B';
exception when check_violation then raise notice 'OK contraparte de outra empresa é recusada'; end $$;
do $$ begin
  insert into contratos (organizacao_id, contraparte_id, commodity_id, volume, preco_fixo)
  values ('a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 1, 10);
  raise exception 'DEVERIA falhar: commodity da B';
exception when check_violation then raise notice 'OK commodity de outra empresa é recusada'; end $$;
do $$ begin
  insert into contratos (organizacao_id, contraparte_id, commodity_id, volume, preco_fixo, projeto_id)
  values ('a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 1, 10, 'b4000000-0000-0000-0000-000000000001');
  raise exception 'DEVERIA falhar: projeto da B';
exception when check_violation then raise notice 'OK projeto de outra empresa é recusado'; end $$;

-- 4. Cliente com contrato não pode ser apagado.
do $$ begin
  delete from clientes where id = 'a2000000-0000-0000-0000-000000000001';
  raise exception 'DEVERIA falhar: cliente com contrato';
exception when foreign_key_violation then raise notice 'OK cliente com contrato não some'; end $$;

-- 5. Sigilo entre empresas: B, master e estranho não veem nem escrevem nos contratos da A.
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
do $$ declare n int; begin
  select count(*) into n from contratos; if n <> 0 then raise exception 'B viu % contrato(s) da A', n; end if;
  update contratos set volume = 1; get diagnostics n = row_count; if n <> 0 then raise exception 'B alterou contrato da A'; end if;
  delete from contratos; get diagnostics n = row_count; if n <> 0 then raise exception 'B apagou contrato da A'; end if;
  raise notice 'OK outra empresa não vê, não altera e não apaga';
end $$;
do $$ begin
  insert into contratos (organizacao_id, contraparte_id, commodity_id, volume, preco_fixo)
  values ('a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 1, 10);
  raise exception 'DEVERIA falhar: B lançando na A';
exception when insufficient_privilege then raise notice 'OK outra empresa não lança contrato na A'; end $$;
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
do $$ declare n int; begin
  select count(*) into n from contratos; if n <> 0 then raise exception 'master viu % contrato(s)', n; end if;
  raise notice 'OK master não lê contratos';
end $$;
set local request.jwt.claim.sub = 'f0000000-0000-0000-0000-00000000000f';
do $$ declare n int; begin
  select count(*) into n from contratos; if n <> 0 then raise exception 'estranho viu % contrato(s)', n; end if;
  raise notice 'OK estranho não lê contratos';
end $$;

-- 6. Empresa suspensa: lê o que tem, não fecha negócio novo nem altera.
set local role postgres;
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
update organizacoes set ativa = false where id = 'a1000000-0000-0000-0000-000000000000';
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$ declare n int; begin
  select count(*) into n from contratos; if n <> 3 then raise exception 'suspensa deveria ler os 3, leu %', n; end if;
  update contratos set volume = 1; get diagnostics n = row_count; if n <> 0 then raise exception 'suspensa alterou contrato'; end if;
  raise notice 'OK suspensa lê e não altera';
end $$;
do $$ begin
  insert into contratos (organizacao_id, contraparte_id, commodity_id, volume, preco_fixo)
  values ('a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 1, 10);
  raise exception 'DEVERIA falhar: suspensa lançando';
exception when insufficient_privilege then raise notice 'OK suspensa não lança contrato novo'; end $$;

rollback;
