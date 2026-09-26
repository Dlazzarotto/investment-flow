-- 0033 — o investidor vê os contratos que compõem o resultado do projeto (idempotente).
--
-- A receita da carteira vem de resumo_projeto(), que soma a venda antiga OU o contrato
-- concluído (0022/0032). A tabela abaixo dela listava só as vendas antigas: com um
-- contrato novo concluído, a receita subia e nenhuma linha explicava de onde.
-- O investidor não lê `contratos` (RLS), e não deve ler: lá estão partes, preços de
-- outras operações e nomes. Esta função devolve SÓ números das linhas que entram no
-- resultado — sem número de contrato, sem cliente — pela mesma regra de resumo_projeto.

create or replace function public.contratos_do_projeto(p_projeto_id uuid)
returns table (id uuid, data date, direcao text, volume numeric, unidade text, moeda text, preco numeric, valor numeric)
language sql stable security definer set search_path = public as $cip$
  select c.id,
         coalesce(c.fim_entregas, c.data_assinatura, c.atualizado_em::date),
         c.direcao::text, c.volume, c.unidade::text, c.moeda::text, c.preco_fixo,
         round(c.volume * c.preco_fixo, 2)
    from public.contratos c
    join public.projetos p on p.id = c.projeto_id
   where c.projeto_id = p_projeto_id and c.conta = 'projeto' and c.papel = 'principal'
     and c.status = 'concluido' and c.tipo_preco = 'fixo' and c.venda_origem_id is null
     and c.moeda = p.moeda
     and public.pode_ver_projeto(p_projeto_id)
   order by 2, 1
$cip$;

grant execute on function public.contratos_do_projeto(uuid) to authenticated;

-- Conferência: tem que voltar true.
select exists (select 1 from pg_proc where proname = 'contratos_do_projeto' and prosecdef) as contratos_do_projeto;
