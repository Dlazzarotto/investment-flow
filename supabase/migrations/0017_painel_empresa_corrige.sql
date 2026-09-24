-- 0017 — Conserta painel_empresa() da 0016
--
-- A 0016 cria a função sem erro, mas ela FALHA EM TODA CHAMADA:
--
--   column reference "moeda" is ambiguous
--
-- Em PL/pgSQL, cada coluna de `returns table (...)` vira uma variável dentro do
-- corpo. A 0016 lia `select moeda from meus` sem prefixo, e o Postgres não sabe
-- se é a coluna ou a variável de saída. Criar a função não acusa nada: o erro só
-- aparece na primeira chamada. Como /painel é a página de entrada, todo ADM
-- cairia na tela de erro logo depois do login.
--
-- Na mesma reescrita, dois defeitos de regra:
--   1. USD entrava SEMPRE. Empresa que só opera em BRL ganhava um bloco USD todo
--      zerado: o "zero que parece número real" que o painel promete não mostrar.
--      Agora USD só entra quando a empresa não tem projeto nenhum (sem ele a
--      função devolveria zero linhas e a tela ficaria em branco).
--   2. "Receita no mês" somava tudo a partir do dia 1, inclusive venda com data
--      futura. Agora vai do dia 1 ao último dia do mês corrente.
-- E a soma passa a ser, de fato, uma passada por tabela agrupando por moeda. A
-- 0016 dizia isso no comentário, mas repetia uma subconsulta por moeda e por
-- coluna.
--
-- Mesma assinatura e mesmo retorno da 0016: `create or replace` basta, e o
-- resultado é o mesmo tendo ou não rodado a 0016 antes. Idempotente.
-- Teste: tests/schema8.test.sql.

-- ---------------------------------------------------------------------------
-- BLOCO 1 — o painel
-- ---------------------------------------------------------------------------
create or replace function public.painel_empresa(p_organizacao_id uuid)
returns table (moeda public.moeda, clientes int, clientes_ativos int, fornecedores int, commodities int, projetos int, investimento numeric, receita numeric, custo_vendas numeric, despesas numeric, saida numeric, saldo numeric, receita_mes numeric, vendas_qtd int)
language plpgsql security definer set search_path = public as $painel2$
declare
  v_mes date := date_trunc('month', current_date)::date;
begin
  if not public.eh_admin_organizacao(p_organizacao_id) then
    raise exception 'Somente a administração da empresa vê este painel.' using errcode = 'insufficient_privilege';
  end if;

  -- TODA coluna leva prefixo de tabela: as colunas de saída acima são variáveis
  -- aqui dentro, e um nome solto que coincida com uma delas derruba a função.
  return query
  with meus as (
    -- pode_ver_projeto() faz o painel respeitar suspensão e papel sem repetir
    -- essas regras.
    select p.id, p.moeda as m
      from public.projetos p
     where p.organizacao_id = p_organizacao_id
       and public.pode_ver_projeto(p.id)
  ),
  moedas as (
    select distinct u.m from meus u
    union all
    select 'USD'::public.moeda where not exists (select 1 from meus)
  ),
  inv as (
    select u.m, sum(i.valor_total) as total
      from public.investimentos i join meus u on u.id = i.projeto_id
     group by u.m
  ),
  ven as (
    select u.m, sum(v.receita_total) as rec, sum(v.custo_total) as custo,
           sum(v.receita_total) filter (
             where v.data >= v_mes and v.data < (v_mes + interval '1 month')::date) as rec_mes,
           count(*)::int as qtd
      from public.vendas v join meus u on u.id = v.projeto_id
     group by u.m
  ),
  des as (
    select u.m, sum(y.valor) as total
      from public.despesas y join meus u on u.id = y.projeto_id
     group by u.m
  ),
  soma as (
    select mo.m,
           coalesce(inv.total, 0) as s_inv, coalesce(ven.rec, 0) as s_rec,
           coalesce(ven.custo, 0) as s_custo, coalesce(des.total, 0) as s_des,
           coalesce(ven.rec_mes, 0) as s_mes, coalesce(ven.qtd, 0) as s_qtd
      from moedas mo
      left join inv on inv.m = mo.m
      left join ven on ven.m = mo.m
      left join des on des.m = mo.m
  ),
  contagens as (
    select (select count(*)::int from public.clientes c where c.organizacao_id = p_organizacao_id) as cli,
           (select count(*)::int from public.clientes c where c.organizacao_id = p_organizacao_id and c.ativo) as cli_ativos,
           (select count(*)::int from public.fornecedores f where f.organizacao_id = p_organizacao_id) as forn,
           (select count(*)::int from public.commodities k where k.organizacao_id = p_organizacao_id) as comm,
           (select count(*)::int from meus) as proj
  )
  select s.m, c.cli, c.cli_ativos, c.forn, c.comm, c.proj,
         s.s_inv, s.s_rec, s.s_custo, s.s_des,
         -- As três saídas (regra 6 do CLAUDE.md): saída e saldo derivam das
         -- parcelas, então não têm como divergir delas.
         s.s_inv + s.s_custo + s.s_des,
         s.s_rec - (s.s_inv + s.s_custo + s.s_des),
         s.s_mes, s.s_qtd
    from soma s cross join contagens c
   order by s.m;
end $painel2$;

-- ---------------------------------------------------------------------------
-- BLOCO 2 — permissão de execução
-- ---------------------------------------------------------------------------
grant execute on function public.painel_empresa(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- BLOCO 3 — conferência ("rodei" não é prova de que entrou inteira).
-- Tem que voltar true. Se voltar false, rode de novo o BLOCO 1 sozinho.
-- ---------------------------------------------------------------------------
select exists (
  select 1 from pg_proc
   where proname = 'painel_empresa'
     and prosrc like '%not exists (select 1 from meus)%'
) as painel_empresa_corrigida;
