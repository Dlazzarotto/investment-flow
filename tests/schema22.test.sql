-- Testes da 0032 — travas da auditoria (psql -v ON_ERROR_STOP=1, rodar da raiz). Desfaz tudo.
begin;
\i supabase/migrations/0032_auditoria_travas.sql
\i supabase/migrations/0032_auditoria_travas.sql
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'adm@a.com', now()),
  ('a0000000-0000-0000-0000-0000000000a2', 'gerente@a.com', now()),
  ('a0000000-0000-0000-0000-0000000000a3', 'escritorio@a.com', now()),
  ('50000000-0000-0000-0000-000000000005', 'adm@s.com', now()),
  ('e0000000-0000-0000-0000-00000000000e', 'master@plataforma.com', now()) on conflict do nothing;
insert into plataforma_admins (email) values ('master@plataforma.com') on conflict do nothing;
insert into organizacoes (id, nome, criado_por) values
  ('a1000000-0000-0000-0000-000000000000', 'A', 'a0000000-0000-0000-0000-00000000000a'),
  ('51000000-0000-0000-0000-000000000000', 'Suspensa', '50000000-0000-0000-0000-000000000005');
-- Só o master altera o contrato da empresa (trigger contrato_so_master).
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
update organizacoes set ativa = false where id = '51000000-0000-0000-0000-000000000000';
insert into organizacao_membros (organizacao_id, email) values
  ('a1000000-0000-0000-0000-000000000000', 'adm@a.com'), ('51000000-0000-0000-0000-000000000000', 'adm@s.com');
insert into commodities (id, organizacao_id, nome) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'Ferro');
insert into projetos (id, nome, data_inicio, moeda, organizacao_id, owner_id) values
  ('a4000000-0000-0000-0000-000000000001', 'Mina BRL', '2026-09-01', 'BRL', 'a1000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-00000000000a');
insert into projeto_membros (projeto_id, email, papel) values
  ('a4000000-0000-0000-0000-000000000001', 'gerente@a.com', 'manager'),
  ('a4000000-0000-0000-0000-000000000001', 'escritorio@a.com', 'escritorio');
insert into investimentos (projeto_id, data, categoria, item, quantidade, valor_unitario) values
  ('a4000000-0000-0000-0000-000000000001', '2026-09-02', 'infraestrutura', 'Britador', 1, 1000);
insert into participantes (id, projeto_id, nome, tipo, percentual) values
  ('a5000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'Sócio', 'socio', 50);
insert into aportes (projeto_id, participante_id, tipo, descricao, valor, data) values
  ('a4000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'dinheiro', 'Capital', 1000, '2026-09-02');
insert into vendas (id, projeto_id, categoria, volume, unidade, preco_unitario, data) values
  ('a6000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'venda_produto', 10, 't', 100, '2026-09-10');
-- Contratos concluídos por conta do projeto: venda BRL (entra), venda USD (fora: outra moeda),
-- compra BRL (saída), agente BRL 10 % (da empresa: fora), e o convertido da venda antiga (não soma de novo).
insert into contratos (id, organizacao_id, commodity_id, projeto_id, conta, direcao, papel, status, volume, moeda,
                       tipo_preco, preco_fixo, comissao_base, comissao_valor, venda_origem_id) values
  ('a7000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
   'a4000000-0000-0000-0000-000000000001', 'projeto', 'venda', 'principal', 'concluido', 10, 'BRL', 'fixo', 50, null, null, null),
  ('a7000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
   'a4000000-0000-0000-0000-000000000001', 'projeto', 'venda', 'principal', 'concluido', 10, 'USD', 'fixo', 999, null, null, null),
  ('a7000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
   'a4000000-0000-0000-0000-000000000001', 'projeto', 'compra', 'principal', 'concluido', 10, 'BRL', 'fixo', 20, null, null, null),
  ('a7000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
   'a4000000-0000-0000-0000-000000000001', 'projeto', 'venda', 'agente', 'concluido', 10, 'BRL', 'fixo', 100, 'pct_valor', 10, null),
  ('a7000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
   'a4000000-0000-0000-0000-000000000001', 'projeto', 'venda', 'principal', 'concluido', 10, 'BRL', 'fixo', 100, null, null,
   'a6000000-0000-0000-0000-000000000001');
set local role authenticated;

-- 1. Resultado do projeto (dono). Receita: venda antiga 1.000 + contrato 500 = 1.500 (comissão é da empresa).
--    Saída: capex 1.000 + compra 200 = 1.200. O contrato em USD não entra; o convertido não soma duas vezes.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$ declare r record; begin
  select * into r from resumo_projeto('a4000000-0000-0000-0000-000000000001');
  if r.receita_total <> 1500 then raise exception 'receita % (esperado 1500)', r.receita_total; end if;
  if r.custo_vendas_total <> 200 then raise exception 'custo % (esperado 200: a compra)', r.custo_vendas_total; end if;
  if r.investimento_total <> 1000 or r.aportes_total <> 1000 then raise exception 'dono deveria ver o capital'; end if;
  if r.saldo <> 300 then raise exception 'saldo % (esperado 300)', r.saldo; end if;
  raise notice 'OK resultado do projeto: moeda do projeto, compra é saída, intermediação fora, sem dupla contagem';
end $$;

-- 2. Gerente e escritório não enxergam capital.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-0000000000a2';
do $$ declare r record; n int; begin
  select * into r from resumo_projeto('a4000000-0000-0000-0000-000000000001');
  if r.investimento_total <> 0 or r.aportes_total <> 0 then raise exception 'gerente viu capital'; end if;
  if r.saldo <> 1300 then raise exception 'saldo do gerente % (esperado 1300, sem capex)', r.saldo; end if;
  select count(*) into n from aportes; if n <> 0 then raise exception 'gerente viu aportes'; end if;
  raise notice 'OK gerente não vê investimento nem aportes';
end $$;

-- 3. Escritório lança no custeio; alterar sem PIN não altera nada.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-0000000000a3';
insert into estimativas_custo (id, projeto_id, nome, commodity, moeda, volume_total, unidade)
values ('a9000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'Lote 1', 'Ferro', 'BRL', 100, 't');
do $$ declare n int; begin
  update estimativas_custo set nome = 'mudou' where id = 'a9000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'escritório alterou sem PIN'; end if;
  raise notice 'OK escritório lança no custeio; alterar exige PIN';
end $$;

-- 4. Contrato convertido: números travados; excluir leva a venda antiga.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$ begin
  update contratos set volume = 99 where id = 'a7000000-0000-0000-0000-000000000005';
  raise exception 'DEVERIA falhar: volume do convertido';
exception when check_violation then raise notice 'OK contrato convertido não muda os números'; end $$;
update contratos set observacoes = 'nota livre' where id = 'a7000000-0000-0000-0000-000000000005';
delete from contratos where id = 'a7000000-0000-0000-0000-000000000005';
do $$ declare r record; begin
  if exists (select 1 from vendas where id = 'a6000000-0000-0000-0000-000000000001') then raise exception 'venda antiga ficou'; end if;
  select * into r from resumo_projeto('a4000000-0000-0000-0000-000000000001');
  if r.receita_total <> 500 then raise exception 'receita após excluir % (esperado 500)', r.receita_total; end if;
  raise notice 'OK excluir o convertido tira a receita do projeto também';
end $$;

-- 5. Histórico: cadastro da empresa ganha a empresa e o ADM lê.
insert into clientes (organizacao_id, nome) values ('a1000000-0000-0000-0000-000000000000', 'Cliente novo');
do $$ begin
  if not exists (select 1 from historico where tabela = 'clientes' and organizacao_id = 'a1000000-0000-0000-0000-000000000000') then
    raise exception 'ADM não lê o histórico do cadastro'; end if;
  raise notice 'OK histórico dos cadastros é da empresa e o ADM lê';
end $$;

-- 6. Empresa suspensa: aviso para o ADM sem projeto, e nada grava.
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000005';
do $$ begin
  if not meu_acesso_suspenso() then raise exception 'ADM sem projeto não recebe o aviso'; end if;
  raise notice 'OK aviso de suspensão para o ADM sem projeto';
end $$;
do $$ begin
  insert into clientes (organizacao_id, nome) values ('51000000-0000-0000-0000-000000000000', 'X');
  raise exception 'DEVERIA falhar: cliente em empresa suspensa';
exception when insufficient_privilege then raise notice 'OK empresa suspensa não cadastra cliente'; end $$;
do $$ begin
  insert into projetos (nome, data_inicio, moeda) values ('P', '2026-09-25', 'BRL');
  raise exception 'DEVERIA falhar: projeto em empresa suspensa';
exception when insufficient_privilege then raise notice 'OK empresa suspensa não cria projeto'; end $$;
do $$ begin
  insert into organizacao_membros (organizacao_id, email) values ('51000000-0000-0000-0000-000000000000', 'novo@s.com');
  raise exception 'DEVERIA falhar: ADM em empresa suspensa';
exception when insufficient_privilege then raise notice 'OK empresa suspensa não traz administrador'; end $$;

-- 7. O master ainda gere os administradores da suspensa; e não exclui empresa com locais.
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
update organizacao_membros set email = 'adm2@s.com' where email_normalizado = 'adm@s.com';
do $$ begin
  if not exists (select 1 from organizacao_membros where email_normalizado = 'adm2@s.com') then
    raise exception 'master não trocou o ADM da suspensa'; end if;
  raise notice 'OK master troca o ADM (update de e-mail, sem gastar assento)';
end $$;
reset role;
insert into locais (organizacao_id, nome, tipo) values ('51000000-0000-0000-0000-000000000000', 'Porto', 'porto');
set local role authenticated;
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
do $$ begin
  if excluir_empresa('51000000-0000-0000-0000-000000000000') then raise exception 'excluiu empresa com locais'; end if;
  raise notice 'OK empresa com locais não é "vazia"';
end $$;

-- 8. Dono de projeto de empresa suspensa: excluir_projeto devolve false (não quebra num check).
reset role;
insert into projetos (id, nome, data_inicio, moeda, organizacao_id, owner_id) values
  ('54000000-0000-0000-0000-000000000001', 'Da suspensa', '2026-09-01', 'BRL', '51000000-0000-0000-0000-000000000000',
   '50000000-0000-0000-0000-000000000005');
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-000000000005';
do $$ begin
  if excluir_projeto('54000000-0000-0000-0000-000000000001') then raise exception 'excluiu projeto de empresa suspensa'; end if;
  raise notice 'OK excluir_projeto com a empresa suspensa devolve false';
end $$;
rollback;
