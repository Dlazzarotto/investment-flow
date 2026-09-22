-- ============================================================================
-- 0003_participacao_lock.sql — Trava de 100 % à prova de concorrência
--
-- Problema: fn_validar_participacao lia a soma das participações sem travar nada.
-- Dois INSERT simultâneos de participantes no mesmo projeto liam a soma antes de
-- o outro gravar e os dois passavam — o total podia terminar acima de 100 %.
--
-- Correção: travar a linha do projeto (select ... for update) antes de somar.
-- A segunda transação espera a primeira terminar e então soma o valor já gravado.
-- Executar depois de 0001_schema.sql. Idempotente (create or replace).
-- ============================================================================

create or replace function public.fn_validar_participacao(p_projeto_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_dono  numeric;
  v_total numeric;
begin
  -- Trava a linha do projeto: serializa as validações do mesmo projeto.
  -- No trigger de projetos o UPDATE já segurava esta linha, então aqui é inócuo.
  select p.participacao_pct
    into v_dono
    from public.projetos p
   where p.id = p_projeto_id
     for update;

  -- Projeto inexistente ou invisível para este usuário (RLS): nada a validar.
  if not found then
    return;
  end if;

  select v_dono + coalesce(sum(pp.percentual), 0)
    into v_total
    from public.participantes pp
   where pp.projeto_id = p_projeto_id;

  if v_total > 100 then
    raise exception 'A soma das participações do projeto ultrapassa 100%% (total: % %%).', round(v_total, 2)
      using errcode = 'check_violation';
  end if;
end $$;

-- Os triggers de 0001_schema.sql continuam apontando para esta função; recriados
-- aqui apenas para a migration poder ser executada em um banco novo em qualquer ordem.
drop trigger if exists participantes_validar on public.participantes;
create trigger participantes_validar
  after insert or update on public.participantes
  for each row execute function public.tg_participantes_validar();

drop trigger if exists projetos_validar on public.projetos;
create trigger projetos_validar
  after update of participacao_pct on public.projetos
  for each row execute function public.tg_projetos_validar();
