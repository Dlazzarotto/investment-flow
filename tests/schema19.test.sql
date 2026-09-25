-- Testes da 0029 — catálogo em árvore, locais e termos do contrato (psql -v ON_ERROR_STOP=1, rodar da raiz). Desfaz tudo.
begin;
\i supabase/migrations/0029_catalogo_locais_termos.sql
\i supabase/migrations/0029_catalogo_locais_termos.sql
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'adm@a.com', now()),
  ('b0000000-0000-0000-0000-00000000000b', 'adm@b.com', now()),
  ('e0000000-0000-0000-0000-00000000000e', 'master@plataforma.com', now()) on conflict do nothing;
insert into plataforma_admins (email) values ('master@plataforma.com') on conflict do nothing;
insert into organizacoes (id, nome, criado_por) values
  ('a1000000-0000-0000-0000-000000000000', 'A', 'a0000000-0000-0000-0000-00000000000a'),
  ('b1000000-0000-0000-0000-000000000000', 'B', 'b0000000-0000-0000-0000-00000000000b');
insert into organizacao_membros (organizacao_id, email) values
  ('a1000000-0000-0000-0000-000000000000', 'adm@a.com'), ('b1000000-0000-0000-0000-000000000000', 'adm@b.com');
set local role authenticated;

-- B cria um grupo próprio (para o teste de "grupo de outra empresa").
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
insert into commodity_grupos (id, organizacao_id, nome) values ('b3000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000000', 'Grupo da B');
insert into locais (id, organizacao_id, nome, tipo) values ('b7000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000000', 'Porto da B', 'porto');

set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
-- 1. Grupos: A vê os 12 padrão, não vê o da B, cria o seu.
do $$ declare n int; begin
  select count(*) into n from commodity_grupos; if n <> 12 then raise exception 'A deveria ver 12 grupos, viu %', n; end if;
  insert into commodity_grupos (organizacao_id, nome) values ('a1000000-0000-0000-0000-000000000000', 'Especialidades');
  raise notice 'OK grupos: 12 padrão, o da outra empresa invisível, e o próprio criado';
end $$;
do $$ begin
  insert into commodity_grupos (codigo) values ('invasor');
  raise exception 'DEVERIA falhar: empresa criando grupo padrão';
exception when insufficient_privilege then raise notice 'OK só a lista pronta é padrão (empresa não cria grupo global)'; end $$;

-- 2. Commodity no grupo padrão; grupo da B recusado.
insert into commodities (id, organizacao_id, nome, grupo_id) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'Iron Ore',
   (select id from commodity_grupos where codigo = 'minerios')),
  ('a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000000', 'Soybeans',
   (select id from commodity_grupos where codigo = 'graos_oleaginosas'));
do $$ begin
  insert into commodities (organizacao_id, nome, grupo_id)
  values ('a1000000-0000-0000-0000-000000000000', 'Intrusa', 'b3000000-0000-0000-0000-000000000001');
  raise exception 'DEVERIA falhar: grupo de outra empresa';
exception when insufficient_privilege then raise notice 'OK commodity não entra em grupo de outra empresa'; end $$;

-- 3. Grades e especificação por grade.
insert into commodity_grades (id, organizacao_id, commodity_id, nome) values
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'Fines 62% Fe'),
  ('a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000002', 'GMO Grade 2');
insert into commodity_parametros (commodity_id, grade_id, nome, unidade, referencia, minimo)
values ('a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'Fe', '%', 62, 60);
do $$ begin
  insert into commodity_parametros (commodity_id, grade_id, nome) values
    ('a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000002', 'Fe');
  raise exception 'DEVERIA falhar: grade de soja na especificação do minério';
exception when foreign_key_violation then raise notice 'OK especificação só usa grade da própria commodity'; end $$;

-- 4. Locais e contrato com os termos novos.
insert into locais (id, organizacao_id, nome, tipo, pais, unlocode, calado_max_m) values
  ('a7000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'Puerto Aguirre', 'terminal_fluvial', 'Bolívia', null, 2.8),
  ('a7000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000000', 'Nueva Palmira', 'porto', 'Uruguai', 'UY NVP', 9.75);
insert into contratos (id, organizacao_id, commodity_id, grade_id, direcao, papel, modalidade, status, volume, unidade, moeda,
                       tipo_preco, preco_fixo, evento_saldo, embalagem, base_preco, ponto_carga_id, transbordo_id,
                       rota_fluvial, barcacas_qtd, porte_navio, calado_max_m, frete_valor, demurrage_dia,
                       inspetora, inspecao_local, inspecao_custo, documentos_exigidos, entrega_interior)
values ('a5000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
        'a3000000-0000-0000-0000-000000000001', 'venda', 'principal', 'spot', 'rascunho', 50000, 't', 'USD', 'fixo', 119,
        'bl', 'granel', 'dmt', 'a7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000002',
        'Hidrovia Paraguai–Paraná', 12, 'supramax', 9.75, 38.5, 18000, 'SGS', 'ambos', 'dividido',
        '{bl,fatura_comercial,certificado_origem,certificado_qualidade,certificado_peso}', 'caminhao');
do $$ begin raise notice 'OK contrato grava produto, grade, rota, navio, frete, demurrage, inspeção e documentos'; end $$;
do $$ begin
  update contratos set grade_id = 'a3000000-0000-0000-0000-000000000002' where id = 'a5000000-0000-0000-0000-000000000001';
  raise exception 'DEVERIA falhar: grade de outra commodity';
exception when foreign_key_violation then raise notice 'OK contrato só aceita grade da própria commodity'; end $$;
do $$ begin
  update contratos set ponto_descarga_id = 'b7000000-0000-0000-0000-000000000001' where id = 'a5000000-0000-0000-0000-000000000001';
  raise exception 'DEVERIA falhar: local de outra empresa';
exception when foreign_key_violation then raise notice 'OK contrato só aceita local da própria empresa'; end $$;
do $$ begin
  update contratos set documentos_exigidos = '{bl,passaporte}' where id = 'a5000000-0000-0000-0000-000000000001';
  raise exception 'DEVERIA falhar: documento fora da lista';
exception when check_violation then raise notice 'OK documento exigido só da lista conhecida'; end $$;

-- 5. Sigilo: B e o master não veem grades nem locais da A.
set local request.jwt.claim.sub = 'b0000000-0000-0000-0000-00000000000b';
do $$ declare n int; begin
  select (select count(*) from commodity_grades) + (select count(*) from locais where organizacao_id <> 'b1000000-0000-0000-0000-000000000000') into n;
  if n <> 0 then raise exception 'B viu % item(ns) da A', n; end if;
  raise notice 'OK outra empresa não vê grades nem locais';
end $$;
set local request.jwt.claim.sub = 'e0000000-0000-0000-0000-00000000000e';
do $$ declare n int; begin
  select (select count(*) from commodity_grades) + (select count(*) from locais) into n;
  if n <> 0 then raise exception 'master viu % item(ns)', n; end if;
  raise notice 'OK master não lê catálogo nem locais das empresas';
end $$;

-- 6. Excluir o grade não apaga o contrato: só solta o grade.
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
delete from commodity_grades where id = 'a3000000-0000-0000-0000-000000000001';
do $$ begin
  if (select grade_id from contratos where id = 'a5000000-0000-0000-0000-000000000001') is not null then raise exception 'grade ficou'; end if;
  if (select commodity_id from contratos where id = 'a5000000-0000-0000-0000-000000000001') is null then raise exception 'commodity sumiu junto'; end if;
  raise notice 'OK excluir grade solta o contrato sem perder a commodity';
end $$;
rollback;
