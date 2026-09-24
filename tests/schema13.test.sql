-- Testes da 0022 — projetos sob gestão (psql -v ON_ERROR_STOP=1, rodar da raiz do repositório).
-- Monta um projeto da 1ª versão com vendas, aplica a migration DENTRO da transação e confere. Desfaz tudo.
begin;
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'adm@empresa-a.com', now()) on conflict do nothing;
insert into organizacoes (id, nome, criado_por) values
  ('a1000000-0000-0000-0000-000000000000', 'DSD', 'a0000000-0000-0000-0000-00000000000a');
insert into organizacao_membros (organizacao_id, email) values ('a1000000-0000-0000-0000-000000000000', 'adm@empresa-a.com');
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
-- Projeto antigo: criado FORA da empresa, com duas vendas da 1ª versão (uma com custo direto).
insert into projetos (id, nome, data_inicio, moeda, participacao_pct) values
  ('a4000000-0000-0000-0000-000000000001', 'Mineradora Bolivia', '2026-09-22', 'USD', 50);
update projetos set organizacao_id = null where id = 'a4000000-0000-0000-0000-000000000001';
insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, custo_unitario, data) values
  ('a4000000-0000-0000-0000-000000000001', 'venda_produto', 1000, 'Toneladas', 100, 40, '2026-09-01'),
  ('a4000000-0000-0000-0000-000000000001', 'venda_produto', 500, 'Toneladas', 110, 0, '2026-09-10');

\i supabase/migrations/0022_projetos_sob_gestao.sql
\i supabase/migrations/0022_projetos_sob_gestao.sql

set local role authenticated;
do $$ declare n int; r record; begin
  select organizacao_id, status, participacao_pct into r from projetos where id = 'a4000000-0000-0000-0000-000000000001';
  if r.organizacao_id is distinct from 'a1000000-0000-0000-0000-000000000000' then raise exception 'projeto não entrou na empresa do dono'; end if;
  if r.status <> 'em_andamento' or r.participacao_pct <> 50 then raise exception 'status/participação errados: % %', r.status, r.participacao_pct; end if;
  raise notice 'OK projeto antigo entrou na empresa, em andamento, %% pactuada intacta';
  select count(*) into n from contratos where venda_origem_id is not null;
  if n <> 2 then raise exception 'esperava 2 contratos convertidos (migration rodada 2x), veio %', n; end if;
  select count(*) into n from contratos where conta = 'projeto' and status = 'concluido' and direcao = 'venda';
  if n <> 2 then raise exception 'convertidos deveriam ser vendas concluídas por conta do projeto'; end if;
  raise notice 'OK vendas antigas viraram contratos concluídos — rodando 2x não duplica';
  select * into r from resumo_projeto('a4000000-0000-0000-0000-000000000001');
  if r.receita_total <> 155000 or r.custo_vendas_total <> 40000 then
    raise exception 'resumo contou em dobro ou perdeu: receita % custo %', r.receita_total, r.custo_vendas_total; end if;
  raise notice 'OK resumo do investidor: mesma receita e mesmo custo de antes (sem contar em dobro)';
end $$;

-- Contrato novo concluído por conta do projeto entra no resumo; em andamento, não.
insert into contratos (organizacao_id, commodity_id, projeto_id, conta, volume, preco_fixo, status)
select 'a1000000-0000-0000-0000-000000000000', id, 'a4000000-0000-0000-0000-000000000001', 'projeto', 10, 200, 'concluido'
  from commodities limit 1;
insert into contratos (organizacao_id, commodity_id, projeto_id, conta, volume, preco_fixo, status)
select 'a1000000-0000-0000-0000-000000000000', id, 'a4000000-0000-0000-0000-000000000001', 'projeto', 10, 999, 'assinado'
  from commodities limit 1;
do $$ declare r record; begin
  select * into r from resumo_projeto('a4000000-0000-0000-0000-000000000001');
  if r.receita_total <> 157000 then raise exception 'contrato concluído não entrou (ou o assinado entrou): %', r.receita_total; end if;
  raise notice 'OK contrato novo concluído soma no resultado do projeto; em execução ainda não';
end $$;

-- Projeto novo nasce com 0 % da empresa: ela administra.
insert into projetos (nome, data_inicio, moeda, organizacao_id) values ('Novo', '2026-10-01', 'USD', 'a1000000-0000-0000-0000-000000000000');
do $$ begin
  if (select participacao_pct from projetos where nome = 'Novo') <> 0 then raise exception 'projeto novo deveria nascer com 0 %%'; end if;
  raise notice 'OK projeto novo nasce com 0 %% da empresa (administradora)';
end $$;
rollback;
