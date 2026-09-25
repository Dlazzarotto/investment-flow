-- Testes da 0030 — catálogo de commodities do mercado (psql -v ON_ERROR_STOP=1, rodar da raiz). Desfaz tudo.
begin;
insert into auth.users (id, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', 'adm@a.com', now()) on conflict do nothing;
insert into organizacoes (id, nome, criado_por) values ('a1000000-0000-0000-0000-000000000000', 'A', 'a0000000-0000-0000-0000-00000000000a');
insert into organizacao_membros (organizacao_id, email) values ('a1000000-0000-0000-0000-000000000000', 'adm@a.com');
-- Commodities que a empresa já tinha, com nomes do jeito que as pessoas escrevem.
insert into commodities (organizacao_id, nome) values
  ('a1000000-0000-0000-0000-000000000000', 'Minério de Ferro'),
  ('a1000000-0000-0000-0000-000000000000', 'IRON ORE'),
  ('a1000000-0000-0000-0000-000000000000', ' Soja '),
  ('a1000000-0000-0000-0000-000000000000', 'Acucar VHP'),
  ('a1000000-0000-0000-0000-000000000000', 'Produto das vendas da 1ª versão');
\i supabase/migrations/0030_catalogo_commodities_mercado.sql
\i supabase/migrations/0030_catalogo_commodities_mercado.sql

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-0000-0000-00000000000a';
do $$ declare n int; begin
  select count(*) into n from commodities_padrao; if n < 60 then raise exception 'catálogo com % itens', n; end if;
  -- todo item do catálogo aponta para um grupo padrão que existe
  select count(*) into n from commodities_padrao p
   where not exists (select 1 from commodity_grupos g where g.codigo = p.grupo_codigo and g.organizacao_id is null);
  if n <> 0 then raise exception '% item(ns) sem grupo', n; end if;
  -- todo grupo padrão tem commodity
  select count(*) into n from commodity_grupos g where g.organizacao_id is null
     and not exists (select 1 from commodities_padrao p where p.grupo_codigo = g.codigo);
  if n <> 0 then raise exception '% grupo(s) vazio(s)', n; end if;
  raise notice 'OK catálogo: todo item tem grupo e todo grupo tem commodity';
end $$;

do $$ begin
  -- "Minério de Ferro" e "IRON ORE" são o mesmo produto: exatamente UM é ligado ao catálogo.
  if (select count(*) from commodities where nome in ('Minério de Ferro', 'IRON ORE') and padrao_codigo = 'iron_ore') <> 1 then
    raise exception 'minério: tinha que ligar exatamente um';
  end if;
  if (select padrao_codigo from commodities where nome = ' Soja ') is distinct from 'soybeans' then raise exception 'soja não encaixou'; end if;
  if (select padrao_codigo from commodities where nome = 'Acucar VHP') is distinct from 'sugar_vhp' then raise exception 'açúcar sem acento não encaixou'; end if;
  if (select grupo_id from commodities where nome = 'Produto das vendas da 1ª versão') is not null then raise exception 'placeholder ganhou grupo'; end if;
  if (select g.codigo from commodities c join commodity_grupos g on g.id = c.grupo_id where c.padrao_codigo = 'iron_ore') <> 'minerios' then
    raise exception 'grupo errado';
  end if;
  raise notice 'OK antigas encaixadas pelo nome (acento e caixa não importam); duplicata e nome desconhecido ficam sem grupo';
end $$;

-- Adotar do catálogo: uma vez por empresa.
insert into commodities (organizacao_id, nome, grupo_id, padrao_codigo)
select 'a1000000-0000-0000-0000-000000000000', 'Corn', g.id, 'corn' from commodity_grupos g where g.codigo = 'graos_oleaginosas';
do $$ begin
  insert into commodities (organizacao_id, nome, padrao_codigo) values ('a1000000-0000-0000-0000-000000000000', 'Milho de novo', 'corn');
  raise exception 'DEVERIA falhar: adotar duas vezes';
exception when unique_violation then raise notice 'OK a mesma commodity do catálogo não entra duas vezes na empresa'; end $$;
do $$ begin
  insert into commodities_padrao (codigo, grupo_codigo, unidade) values ('invasora', 'minerios', 'Toneladas');
  raise exception 'DEVERIA falhar: empresa escrevendo no catálogo';
exception when insufficient_privilege then raise notice 'OK catálogo do mercado é só leitura'; end $$;
rollback;
