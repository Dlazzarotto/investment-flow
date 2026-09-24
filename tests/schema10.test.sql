-- Testes da 0019 — partes, instrumentos, monetização, remuneração da gestão (psql -v ON_ERROR_STOP=1).
-- Roda em transação e desfaz tudo. Usuários: A (ADM da empresa A), B (ADM da empresa B), M (master).
begin;
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'adm@empresa-a.com', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'adm@empresa-b.com', now()),
  ('e0000000-0000-0000-0000-00000000000e', 'master@plataforma.com', now())
on conflict do nothing;
insert into plataforma_admins (email) values ('master@plataforma.com');
insert into organizacoes (id, nome, criado_por) values
  ('a1000000-0000-0000-0000-000000000000', 'DSD', 'a0000000-0000-0000-0000-00000000000a'),
  ('b1000000-0000-0000-0000-000000000000', 'Outra trading', 'b0000000-0000-0000-0000-00000000000b');
insert into organizacao_membros (organizacao_id, email) values
  ('a1000000-0000-0000-0000-000000000000', 'adm@empresa-a.com'),
  ('b1000000-0000-0000-0000-000000000000', 'adm@empresa-b.com');
insert into clientes (id, organizacao_id, nome, tipos) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'Comprador Qingdao', '{comprador}'),
  ('a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000000', 'Mina Mutún', '{vendedor}'),
  ('a2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000000', 'Fin Partner AG', '{financial_partner}'),
  ('b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000000', 'Cliente da B', '{comprador}');
insert into commodities (id, organizacao_id, nome) values
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'Minério de ferro');
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
insert into projetos (id, nome, data_inicio, moeda, organizacao_id) values
  ('a4000000-0000-0000-0000-000000000001', 'Mineradora Bolivia', '2026-09-22', 'USD', 'a1000000-0000-0000-0000-000000000000');
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
insert into projetos (id, nome, data_inicio, moeda, organizacao_id) values
  ('b4000000-0000-0000-0000-000000000001', 'Projeto da B', '2026-09-22', 'USD', 'b1000000-0000-0000-0000-000000000000');

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';

-- 1. Contrato de intermediação sob gestão: DSD agente, por conta do projeto, assinado pela JV.
insert into contratos (id, organizacao_id, numero, commodity_id, papel, volume, preco_fixo,
                       comissao_base, comissao_valor, conta, assinante, projeto_id)
values ('a5000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'DSD-001',
        'a3000000-0000-0000-0000-000000000001', 'agente', 50000, 100, 'pct_valor', 2, 'projeto', 'projeto',
        'a4000000-0000-0000-0000-000000000001');
insert into contrato_partes (organizacao_id, contrato_id, cliente_id, papel) values
  ('a1000000-0000-0000-0000-000000000000', 'a5000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'comprador'),
  ('a1000000-0000-0000-0000-000000000000', 'a5000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'vendedor'),
  ('a1000000-0000-0000-0000-000000000000', 'a5000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000003', 'financial_partner');
do $$ declare n int; begin
  select count(*) into n from contrato_partes; if n <> 3 then raise exception 'esperava 3 partes, veio %', n; end if;
  raise notice 'OK contrato com comprador, vendedor e Financial Partner, sem contraparte única';
end $$;
do $$ begin
  insert into contrato_partes (organizacao_id, contrato_id, cliente_id, papel) values
    ('a1000000-0000-0000-0000-000000000000', 'a5000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'comprador');
  raise exception 'DEVERIA falhar: segundo comprador';
exception when unique_violation then raise notice 'OK um comprador por contrato'; end $$;
insert into contratos (id, organizacao_id, commodity_id, volume, preco_fixo)
values ('a5000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000001', 1, 10);
do $$ begin
  insert into contrato_partes (organizacao_id, contrato_id, cliente_id, papel) values
    ('a1000000-0000-0000-0000-000000000000', 'a5000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001', 'comprador');
  raise exception 'DEVERIA falhar: parte de outra empresa';
exception when foreign_key_violation then raise notice 'OK parte de outra empresa é recusada'; end $$;
do $$ begin
  insert into contratos (organizacao_id, commodity_id, volume, preco_fixo, conta)
  values ('a1000000-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000001', 1, 10, 'projeto');
  raise exception 'DEVERIA falhar: por conta de projeto sem projeto';
exception when check_violation then raise notice 'OK por conta do projeto exige projeto'; end $$;
do $$ begin
  insert into contratos (organizacao_id, commodity_id, volume, preco_fixo, assinante)
  values ('a1000000-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000001', 1, 10, 'projeto');
  raise exception 'DEVERIA falhar: assinado pela JV sem projeto';
exception when check_violation then raise notice 'OK assinado pelo projeto exige projeto'; end $$;

-- 2. Instrumento bancário recebido pelo Financial Partner.
insert into instrumentos (id, organizacao_id, contrato_id, tipo, financial_partner_id, banco_emissor, numero,
                          valor_face, data_emissao, validade, prazo_apresentacao, status)
values ('a6000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'a5000000-0000-0000-0000-000000000001',
        'sblc', 'a2000000-0000-0000-0000-000000000003', 'Bank of China', 'SBLC-778', 10000000,
        '2026-09-01', '2027-09-01', '2026-10-15', 'recebido');
do $$ begin
  insert into instrumentos (organizacao_id, contrato_id, financial_partner_id, valor_face)
  values ('a1000000-0000-0000-0000-000000000000', 'a5000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 1);
  raise exception 'DEVERIA falhar: FP de outra empresa';
exception when foreign_key_violation then raise notice 'OK Financial Partner de outra empresa é recusado'; end $$;
do $$ begin
  insert into instrumentos (organizacao_id, contrato_id, valor_face, data_emissao, validade)
  values ('a1000000-0000-0000-0000-000000000000', 'a5000000-0000-0000-0000-000000000001', 1, '2026-09-01', '2026-01-01');
  raise exception 'DEVERIA falhar: validade antes da emissão';
exception when check_violation then raise notice 'OK validade não antecede a emissão'; end $$;

-- 3. Monetização: FP paga 35 % do face; o valor vai para o projeto; DSD ganha 5 % do monetizado.
insert into monetizacoes (organizacao_id, numero, instrumento_id, financial_partner_id, projeto_id, pct_monetizacao, comissao_pct)
values ('a1000000-0000-0000-0000-000000000000', 'MON-001', 'a6000000-0000-0000-0000-000000000001',
        'a2000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000001', 35, 5);
do $$ begin
  insert into monetizacoes (organizacao_id, instrumento_id, financial_partner_id, pct_monetizacao)
  values ('a1000000-0000-0000-0000-000000000000', 'a6000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000003', 35);
  raise exception 'DEVERIA falhar: sem destino';
exception when check_violation then raise notice 'OK monetização exige destino (vendedor ou projeto)'; end $$;
do $$ begin
  insert into monetizacoes (organizacao_id, instrumento_id, financial_partner_id, beneficiario_id, pct_monetizacao)
  values ('a1000000-0000-0000-0000-000000000000', 'a6000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000003',
          'a2000000-0000-0000-0000-000000000002', 120);
  raise exception 'DEVERIA falhar: 120 %% do face';
exception when check_violation then raise notice 'OK monetização até 100 %% do valor de face'; end $$;
do $$ begin
  delete from contratos where id = 'a5000000-0000-0000-0000-000000000001';
  raise exception 'DEVERIA falhar: contrato com instrumento monetizado';
exception when foreign_key_violation then raise notice 'OK contrato com instrumento monetizado não é apagado'; end $$;
do $$ begin
  delete from clientes where id = 'a2000000-0000-0000-0000-000000000003';
  raise exception 'DEVERIA falhar: FP em uso';
exception when foreign_key_violation then raise notice 'OK Financial Partner em uso não some'; end $$;

-- 4. Remuneração da gestão.
insert into remuneracoes_gestao (organizacao_id, projeto_id, tipo, valor) values
  ('a1000000-0000-0000-0000-000000000000', 'a4000000-0000-0000-0000-000000000001', 'taxa_adm_anual_pct', 2),
  ('a1000000-0000-0000-0000-000000000000', 'a4000000-0000-0000-0000-000000000001', 'por_unidade', 1.5);
do $$ begin
  insert into remuneracoes_gestao (organizacao_id, projeto_id, tipo, valor)
  values ('a1000000-0000-0000-0000-000000000000', 'a4000000-0000-0000-0000-000000000001', 'pct_vendas', 150);
  raise exception 'DEVERIA falhar: 150 %%';
exception when check_violation then raise notice 'OK percentual de gestão até 100 %%'; end $$;
do $$ begin
  insert into remuneracoes_gestao (organizacao_id, projeto_id, tipo, valor)
  values ('a1000000-0000-0000-0000-000000000000', 'b4000000-0000-0000-0000-000000000001', 'fixo_mensal', 1000);
  raise exception 'DEVERIA falhar: projeto da B';
exception when foreign_key_violation then raise notice 'OK remuneração só em projeto da própria empresa'; end $$;

-- 5. Projeto só entra em empresa da qual quem grava é sócio.
do $$ declare n int; begin
  update projetos set organizacao_id = 'b1000000-0000-0000-0000-000000000000' where id = 'a4000000-0000-0000-0000-000000000001';
  raise exception 'DEVERIA falhar: dono enfiando o projeto na empresa B';
exception when insufficient_privilege then raise notice 'OK dono não põe projeto em empresa alheia'; end $$;
do $$ begin
  insert into projetos (nome, data_inicio, moeda, organizacao_id)
  values ('Intruso', '2026-09-22', 'USD', 'b1000000-0000-0000-0000-000000000000');
  raise exception 'DEVERIA falhar: criando projeto dentro da empresa B';
exception when insufficient_privilege then raise notice 'OK ninguém cria projeto em empresa alheia'; end $$;

-- 6. Sigilo: outra empresa e master não veem nada.
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
do $$ declare n int; begin
  select (select count(*) from contrato_partes) + (select count(*) from instrumentos)
       + (select count(*) from monetizacoes) + (select count(*) from remuneracoes_gestao) into n;
  if n <> 0 then raise exception 'B viu % linha(s) da DSD', n; end if;
  raise notice 'OK outra empresa não vê partes, instrumentos, monetizações nem remuneração';
end $$;
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
do $$ declare n int; begin
  select (select count(*) from contrato_partes) + (select count(*) from instrumentos)
       + (select count(*) from monetizacoes) + (select count(*) from remuneracoes_gestao) into n;
  if n <> 0 then raise exception 'master viu % linha(s)', n; end if;
  raise notice 'OK master não vê nada disso';
end $$;

-- 7. Empresa suspensa não lança instrumento.
set local role postgres;
update organizacoes set ativa = false where id = 'a1000000-0000-0000-0000-000000000000';
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$ begin
  insert into instrumentos (organizacao_id, contrato_id, valor_face)
  values ('a1000000-0000-0000-0000-000000000000', 'a5000000-0000-0000-0000-000000000001', 1);
  raise exception 'DEVERIA falhar: suspensa';
exception when insufficient_privilege then raise notice 'OK suspensa não lança instrumento'; end $$;

rollback;
