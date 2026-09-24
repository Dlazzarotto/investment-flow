-- 0022 — Projeto é o que a empresa ADMINISTRA para investidores
--
-- A área do projeto ainda era a da 1ª versão ("meu investimento": vendas,
-- despesas, "sua participação %"). No modelo novo a empresa opera no menu
-- principal (contratos, clientes, fornecedores) e o projeto é administrado para
-- terceiros: tem sócios diretos, JV ou investidores, e um contrato que diz como a
-- empresa ganha (por tonelada, % da venda, % do lucro — remuneracoes_gestao, 0019).
--
-- Esta migration:
--   1. dá STATUS ao projeto: em análise, em andamento, encerrado (o painel mostra
--      os três); os que existem ficam "em andamento";
--   2. projeto novo nasce com participação da empresa = 0 %: ela administra; se
--      também for sócia, entra como mais um participante. Os existentes ficam como
--      estão (não se reescreve % pactuada de ninguém);
--   3. traz para a empresa do dono os projetos criados antes dela existir;
--   4. converte as vendas da 1ª versão em CONTRATOS de venda concluídos, por conta
--      do projeto (decisão do usuário). A venda antiga NÃO é apagada: o contrato
--      guarda `venda_origem_id`, e o resumo do projeto (o que o investidor vê)
--      soma a venda antiga OU o contrato — nunca os dois;
--   5. o resumo do projeto passa a somar também os contratos concluídos por conta
--      dele.
--
-- Sem função PL/pgSQL: o resumo é uma função SQL de UMA instrução (sem `;` no
-- corpo, que é o que o SQL Editor do Supabase parte). Idempotente — rodar de novo
-- não duplica nada. Depende de 0018–0021. Teste: tests/schema13.test.sql.

-- ---------------------------------------------------------------------------
-- BLOCO 1 — status do projeto
-- ---------------------------------------------------------------------------
do $p1$ begin
  create type public.status_projeto as enum ('em_analise', 'em_andamento', 'encerrado');
exception when duplicate_object then null; end $p1$;

alter table public.projetos add column if not exists status public.status_projeto not null default 'em_andamento';

-- ---------------------------------------------------------------------------
-- BLOCO 2 — a empresa administra: projeto novo nasce sem participação dela
-- ---------------------------------------------------------------------------
alter table public.projetos alter column participacao_pct set default 0;

-- ---------------------------------------------------------------------------
-- BLOCO 3 — projeto criado antes da empresa entra na empresa do dono
-- ---------------------------------------------------------------------------
update public.projetos p
   set organizacao_id = (
     select m.organizacao_id
       from public.organizacao_membros m
       join auth.users u on lower(trim(u.email)) = m.email_normalizado
      where u.id = p.owner_id and u.email_confirmed_at is not null
      order by m.criado_em limit 1)
 where p.organizacao_id is null
   and exists (
     select 1 from public.organizacao_membros m
       join auth.users u on lower(trim(u.email)) = m.email_normalizado
      where u.id = p.owner_id and u.email_confirmed_at is not null);

-- ---------------------------------------------------------------------------
-- BLOCO 4 — vendas da 1ª versão viram contratos
-- ---------------------------------------------------------------------------
alter table public.contratos add column if not exists venda_origem_id uuid references public.vendas (id) on delete set null;

create unique index if not exists contratos_venda_origem_uq on public.contratos (venda_origem_id) where venda_origem_id is not null;

-- A venda antiga não tinha commodity: uma por empresa, para o usuário reclassificar depois.
insert into public.commodities (organizacao_id, nome, observacoes)
select distinct p.organizacao_id, 'Produto das vendas da 1ª versão',
       'Criada pela migração 0022: troque pela commodity certa em cada contrato convertido.'
  from public.vendas v join public.projetos p on p.id = v.projeto_id
 where p.organizacao_id is not null
   and not exists (select 1 from public.contratos c where c.venda_origem_id = v.id)
   and not exists (select 1 from public.commodities k
                    where k.organizacao_id = p.organizacao_id and k.nome = 'Produto das vendas da 1ª versão');

insert into public.contratos
  (organizacao_id, commodity_id, projeto_id, conta, assinante, direcao, papel, modalidade, status,
   volume, unidade, moeda, tipo_preco, preco_fixo, data_assinatura, inicio_entregas, fim_entregas,
   evento_saldo, observacoes, venda_origem_id)
select p.organizacao_id,
       (select k.id from public.commodities k
         where k.organizacao_id = p.organizacao_id and k.nome = 'Produto das vendas da 1ª versão'),
       p.id, 'projeto', 'projeto', 'venda', 'principal', 'spot', 'concluido',
       v.volume, v.unidade, p.moeda, 'fixo', v.preco_unitario, v.data, v.data, v.data,
       'carregamento', 'Convertido da aba Vendas da 1ª versão (' || v.categoria::text || ').', v.id
  from public.vendas v join public.projetos p on p.id = v.projeto_id
 where p.organizacao_id is not null
   and not exists (select 1 from public.contratos c where c.venda_origem_id = v.id);

-- ---------------------------------------------------------------------------
-- BLOCO 5 — resumo do projeto: venda antiga OU contrato, nunca os dois
-- ---------------------------------------------------------------------------
-- Receita = vendas da 1ª versão (com o custo direto delas) + contratos de venda
-- CONCLUÍDOS por conta do projeto que NÃO vieram de uma venda antiga. Mesma
-- assinatura e mesmo retorno da 0007: `create or replace` basta, e a carteira do
-- investidor (minha_carteira) herda sem mudar.
create or replace function public.resumo_projeto(p_projeto_id uuid)
returns table (
  investimento_total numeric, receita_total numeric, custo_vendas_total numeric, despesas_total numeric,
  saida_total numeric, saldo numeric, aportes_total numeric
)
language sql stable security definer set search_path = public as $resumo$
  select i.v, v.r + k.r, v.c, d.v, i.v + v.c + d.v, v.r + k.r - (i.v + v.c + d.v), a.v
    from (select coalesce(sum(x.valor_total), 0) as v from public.investimentos x where x.projeto_id = p_projeto_id) i,
         (select coalesce(sum(x.receita_total), 0) as r, coalesce(sum(x.custo_total), 0) as c
            from public.vendas x where x.projeto_id = p_projeto_id) v,
         (select coalesce(sum(round(x.volume * x.preco_fixo, 2)), 0) as r
            from public.contratos x
           where x.projeto_id = p_projeto_id and x.conta = 'projeto' and x.direcao = 'venda'
             and x.papel = 'principal' and x.status = 'concluido' and x.tipo_preco = 'fixo'
             and x.venda_origem_id is null) k,
         (select coalesce(sum(x.valor), 0) as v from public.despesas x where x.projeto_id = p_projeto_id) d,
         (select coalesce(sum(x.valor), 0) as v from public.aportes x where x.projeto_id = p_projeto_id) a
   where public.pode_ver_projeto(p_projeto_id)
$resumo$;

grant execute on function public.resumo_projeto(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- BLOCO 6 — conferência: tem que voltar true nas três colunas.
-- ---------------------------------------------------------------------------
select exists (select 1 from information_schema.columns
                where table_name = 'projetos' and column_name = 'status') as status_projeto,
       not exists (select 1 from public.vendas v join public.projetos p on p.id = v.projeto_id
                    where p.organizacao_id is not null
                      and not exists (select 1 from public.contratos c where c.venda_origem_id = v.id)) as vendas_convertidas,
       exists (select 1 from pg_proc where proname = 'resumo_projeto' and prosrc like '%venda_origem_id is null%') as resumo_novo;
