-- Testes da 0026 — excluir projeto que tem contratos (psql -v ON_ERROR_STOP=1, rodar da raiz). Desfaz tudo.
begin;
\i supabase/migrations/0026_excluir_projeto.sql
\i supabase/migrations/0026_excluir_projeto.sql
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'adm@empresa-a.com', now()),
  ('a0000000-0000-0000-0000-00000000000b', 'socio@empresa-a.com', now()) on conflict do nothing;
insert into organizacoes (id, nome, criado_por) values
  ('a1000000-0000-0000-0000-000000000000', 'DSD', 'a0000000-0000-0000-0000-00000000000a');
insert into organizacao_membros (organizacao_id, email) values
  ('a1000000-0000-0000-0000-000000000000', 'adm@empresa-a.com'),
  ('a1000000-0000-0000-0000-000000000000', 'socio@empresa-a.com');
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
insert into projetos (id, nome, data_inicio, moeda, organizacao_id) values
  ('a4000000-0000-0000-0000-000000000001', 'Mineradora', '2026-09-01', 'USD', 'a1000000-0000-0000-0000-000000000000');
insert into vendas (projeto_id, categoria, volume, unidade, preco_unitario, data) values
  ('a4000000-0000-0000-0000-000000000001', 'venda_produto', 1000, 't', 100, '2026-09-10');
insert into clientes (id, organizacao_id, nome, tipos) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'Banco FP', '{financial_partner}');
-- A 0022 converte a venda antiga num contrato por conta do projeto.
\i supabase/migrations/0022_projetos_sob_gestao.sql
-- Contrato da PRÓPRIA empresa que só cita o projeto: tem que sobreviver.
insert into contratos (id, organizacao_id, commodity_id, projeto_id, conta, assinante, direcao, papel, modalidade, status,
                       volume, unidade, moeda, tipo_preco, preco_fixo, evento_saldo)
select 'a5000000-0000-0000-0000-000000000009', c.organizacao_id, c.commodity_id, c.projeto_id, 'propria', 'empresa',
       'compra', 'principal', 'spot', 'rascunho', 10, 't', 'USD', 'fixo', 1, 'bl'
  from contratos c where c.venda_origem_id is not null;
-- Garantia do contrato do projeto, monetizada em favor do projeto (sem beneficiário).
insert into instrumentos (id, organizacao_id, contrato_id, tipo, valor_face)
select 'a6000000-0000-0000-0000-000000000001', c.organizacao_id, c.id, 'sblc', 1000000
  from contratos c where c.venda_origem_id is not null;
insert into monetizacoes (organizacao_id, instrumento_id, financial_partner_id, projeto_id, pct_monetizacao)
values ('a1000000-0000-0000-0000-000000000000', 'a6000000-0000-0000-0000-000000000001',
        'a2000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 35);

set local role authenticated;

-- 1. O delete direto (o que a tela fazia) falha: é o bug.
do $$ begin
  delete from projetos where id = 'a4000000-0000-0000-0000-000000000001';
  raise exception 'o delete direto não deveria passar';
exception when check_violation then raise notice 'OK reproduzido: delete direto esbarra em contratos_conta_ck'; end $$;

-- 2. Quem não é o dono não exclui, nem pela função — e nada some.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000b';
do $$ begin
  if excluir_projeto('a4000000-0000-0000-0000-000000000001') then raise exception 'sócio que não é dono excluiu'; end if;
  if (select count(*) from contratos) <> 2 or (select count(*) from monetizacoes) <> 1 then
    raise exception 'tentativa recusada apagou coisa';
  end if;
  raise notice 'OK só o dono exclui, e a tentativa recusada não apaga nada';
end $$;

-- 3. O dono exclui: projeto, contrato do projeto, garantia e monetização somem; o da empresa fica.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$ begin
  if not excluir_projeto('a4000000-0000-0000-0000-000000000001') then raise exception 'dono não excluiu'; end if;
  if exists (select 1 from projetos where id = 'a4000000-0000-0000-0000-000000000001') then raise exception 'projeto ficou'; end if;
  if exists (select 1 from contratos where conta = 'projeto') then raise exception 'contrato do projeto ficou'; end if;
  if exists (select 1 from instrumentos) or exists (select 1 from monetizacoes) then raise exception 'garantia/monetização ficou'; end if;
  if (select projeto_id from contratos where id = 'a5000000-0000-0000-0000-000000000009') is not null
     or not exists (select 1 from contratos where id = 'a5000000-0000-0000-0000-000000000009') then
    raise exception 'contrato da empresa deveria ficar, sem o projeto';
  end if;
  raise notice 'OK dono exclui o projeto e o que é dele; contrato da empresa continua';
end $$;
rollback;
