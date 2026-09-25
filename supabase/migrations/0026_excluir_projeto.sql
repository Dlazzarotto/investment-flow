-- 0026 — Excluir projeto que tem contratos
--
-- Excluir a Mineradora FALHAVA: a 0022 converteu as vendas da 1ª versão em
-- contratos "por conta do projeto", e a chave dos contratos manda anular o
-- projeto_id quando o projeto some. Contrato por conta de projeto sem projeto é
-- justamente o que a trava contratos_conta_ck (0019) recusa — e o delete inteiro
-- voltava com erro. O mesmo aconteceria com monetização destinada ao projeto sem
-- beneficiário (monetizacoes_destino_ck) e com monetização presa a garantia de
-- contrato do projeto (restrict).
--
-- excluir_projeto() apaga, NUMA instrução só, o projeto e o que é dele:
--   * contratos por conta do projeto ou assinados por ele (partes e garantias vão
--     junto, em cascata);
--   * monetizações destinadas ao projeto sem outro beneficiário, e as presas às
--     garantias desses contratos.
-- Contrato da PRÓPRIA empresa que só citava o projeto continua, sem o projeto.
-- Tudo ou nada: se qualquer parte for recusada, nada é apagado.
--
-- security invoker: o RLS de cada tabela vale como sempre. Só o DONO exclui
-- (a mesma regra de projetos_excluir, 0004); para qualquer outro a função não
-- apaga nada e devolve false.
--
-- Função SQL de UMA instrução (sem `;` no corpo). Idempotente. Teste:
-- tests/schema16.test.sql.

create or replace function public.excluir_projeto(p_projeto_id uuid)
returns boolean language sql volatile security invoker set search_path = public as $exclp$
  with dono as (
    select p.id from public.projetos p where p.id = p_projeto_id and p.owner_id = auth.uid()
  ),
  ctr as (
    select c.id from public.contratos c
     where c.projeto_id in (select dono.id from dono) and (c.conta = 'projeto' or c.assinante = 'projeto')
  ),
  mon as (
    delete from public.monetizacoes m
     where (m.projeto_id in (select dono.id from dono) and m.beneficiario_id is null)
        or m.instrumento_id in (select i.id from public.instrumentos i where i.contrato_id in (select ctr.id from ctr))
    returning m.id
  ),
  del_ctr as (
    delete from public.contratos c where c.id in (select ctr.id from ctr) returning c.id
  ),
  del_prj as (
    delete from public.projetos p where p.id in (select dono.id from dono) returning p.id
  )
  select exists (select 1 from del_prj)
     and (select count(*) from mon) >= 0 and (select count(*) from del_ctr) >= 0
$exclp$;

revoke execute on function public.excluir_projeto(uuid) from public, anon;
grant execute on function public.excluir_projeto(uuid) to authenticated;

-- Conferência: tem que voltar true.
select exists (select 1 from pg_proc where proname = 'excluir_projeto') as excluir_projeto;
