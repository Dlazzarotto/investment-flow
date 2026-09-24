-- 0016 — Painel da empresa (o dashboard do ADM)
--
-- O ADM trabalha no nível da EMPRESA: quantos clientes, quantos projetos,
-- quanto vendeu, quanto saiu. O projeto é um campo do lançamento, não um lugar
-- onde ele precisa entrar — a visão por projeto é do investidor.
--
-- Até agora não havia consulta consolidada nenhuma: tudo era por projeto, e
-- somar do lado da aplicação exigiria uma ida ao banco por projeto.
--
-- DINHEIRO É SOMADO POR MOEDA. Projeto em USD e projeto em BRL somados no mesmo
-- widget dariam um número que não existe. As contagens repetem em toda linha.
--
-- NÃO ESTÁ AQUI: "a receber" e "a embarcar". Uma venda hoje é volume × preço
-- numa data — não tem situação de pagamento nem de embarque, então não há de
-- onde tirar esses dois números. Precisa de decisão de modelo antes.
--
-- Blocos curtos e etiqueta própria. Idempotente. Depende de 0014 e 0015.

-- ---------------------------------------------------------------------------
-- BLOCO 1 — o painel
-- ---------------------------------------------------------------------------
drop function if exists public.painel_empresa(uuid);

create function public.painel_empresa(p_organizacao_id uuid)
returns table (moeda public.moeda, clientes int, clientes_ativos int, fornecedores int, commodities int, projetos int, investimento numeric, receita numeric, custo_vendas numeric, despesas numeric, saida numeric, saldo numeric, receita_mes numeric, vendas_qtd int)
language plpgsql security definer set search_path = public as $painel$
begin
  if not public.eh_admin_organizacao(p_organizacao_id) then
    raise exception 'Somente a administração da empresa vê este painel.' using errcode = 'insufficient_privilege';
  end if;

  return query
  with meus as (
    -- pode_ver_projeto() aqui faz o painel respeitar suspensão de contrato e
    -- papel sem repetir essas regras.
    select p.id, p.moeda
      from public.projetos p
     where p.organizacao_id = p_organizacao_id
       and public.pode_ver_projeto(p.id)
  ),
  moedas as (
    -- USD sempre entra: sem projeto nenhum a lista sairia vazia e o painel
    -- devolveria zero linhas — tela em branco no lugar de zeros, justo para
    -- quem está começando.
    select m from (select moeda as m from meus union select 'USD'::public.moeda) t
  ),
  contagens as (
    select (select count(*)::int from public.clientes c where c.organizacao_id = p_organizacao_id) as cli,
           (select count(*)::int from public.clientes c where c.organizacao_id = p_organizacao_id and c.ativo) as cli_ativos,
           (select count(*)::int from public.fornecedores f where f.organizacao_id = p_organizacao_id) as forn,
           (select count(*)::int from public.commodities k where k.organizacao_id = p_organizacao_id) as comm,
           (select count(*)::int from meus) as proj
  ),
  -- Uma passada por tabela, agrupando por moeda: somar aqui e derivar depois
  -- evita repetir subconsulta e evita que saída e saldo divirjam das parcelas.
  dinheiro as (
    select mo.m,
      coalesce((select sum(i.valor_total) from public.investimentos i
                 join meus u on u.id = i.projeto_id where u.moeda = mo.m), 0) as investimento,
      coalesce((select sum(v.receita_total) from public.vendas v
                 join meus u on u.id = v.projeto_id where u.moeda = mo.m), 0) as receita,
      coalesce((select sum(v.custo_total) from public.vendas v
                 join meus u on u.id = v.projeto_id where u.moeda = mo.m), 0) as custo_vendas,
      coalesce((select sum(y.valor) from public.despesas y
                 join meus u on u.id = y.projeto_id where u.moeda = mo.m), 0) as despesas,
      coalesce((select sum(v.receita_total) from public.vendas v
                 join meus u on u.id = v.projeto_id
                where u.moeda = mo.m and v.data >= date_trunc('month', current_date)::date), 0) as receita_mes,
      coalesce((select count(*)::int from public.vendas v
                 join meus u on u.id = v.projeto_id where u.moeda = mo.m), 0) as vendas_qtd
    from moedas mo
  )
  select dn.m, c.cli, c.cli_ativos, c.forn, c.comm, c.proj,
         dn.investimento, dn.receita, dn.custo_vendas, dn.despesas,
         -- As três saídas do projeto (regra 6 do CLAUDE.md), somadas.
         dn.investimento + dn.custo_vendas + dn.despesas,
         dn.receita - (dn.investimento + dn.custo_vendas + dn.despesas),
         dn.receita_mes, dn.vendas_qtd
    from dinheiro dn cross join contagens c
   order by dn.m;
end $painel$;

grant execute on function public.painel_empresa(uuid) to authenticated;
