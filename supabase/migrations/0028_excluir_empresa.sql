-- 0028 — O master exclui empresa VAZIA; o master nunca é ADM de empresa
--
-- 1. Remover o último administrador de uma empresa é recusado (0007) — certo:
--    empresa sem ninguém vira dado órfão. Mas a mesma trava disparava quando a
--    EMPRESA INTEIRA era apagada (os administradores saem em cascata), então
--    nenhuma empresa podia ser excluída, nem direto no banco. Agora a trava só
--    vale enquanto a empresa existe.
-- 2. excluir_empresa(): o master exclui a empresa criada por engano ou para
--    teste. SÓ se estiver vazia — sem projetos, clientes, fornecedores,
--    commodities, contratos nem fatura paga. Tudo que é da empresa sai em
--    cascata, então empresa com dados não se exclui: suspende-se (Contrato →
--    Acesso liberado). É security definer porque o master não lê os dados da
--    empresa (e não deve): a função confere o vazio por ele sem mostrar nada.
-- 3. O master não pode ser administrador de empresa: se fosse, leria os dados
--    dela — o contrário do que torna a plataforma vendável. NOT VALID: não
--    reprova linha que já exista; vale para toda inclusão daqui em diante.
--
-- Idempotente. Teste: tests/schema18.test.sql.

-- ---------------------------------------------------------------------------
-- BLOCO 1 — a trava do último administrador só vale com a empresa de pé
-- ---------------------------------------------------------------------------
create or replace function public.tg_organizacao_ultimo_socio()
returns trigger language plpgsql security definer set search_path = public as $ult$
begin
  if exists (select 1 from public.organizacoes o where o.id = old.organizacao_id)
     and (select count(*) from public.organizacao_membros m where m.organizacao_id = old.organizacao_id) <= 1 then
    raise exception 'A organização precisa ter ao menos um sócio.' using errcode = 'check_violation';
  end if;
  return old;
end $ult$;

-- ---------------------------------------------------------------------------
-- BLOCO 2 — excluir empresa vazia (só o master)
-- ---------------------------------------------------------------------------
create or replace function public.excluir_empresa(p_organizacao_id uuid)
returns boolean language sql volatile security definer set search_path = public as $exclemp$
  with alvo as (
    select o.id from public.organizacoes o
     where o.id = p_organizacao_id and public.eh_master()
       and not exists (select 1 from public.projetos x where x.organizacao_id = o.id)
       and not exists (select 1 from public.clientes x where x.organizacao_id = o.id)
       and not exists (select 1 from public.fornecedores x where x.organizacao_id = o.id)
       and not exists (select 1 from public.commodities x where x.organizacao_id = o.id)
       and not exists (select 1 from public.contratos x where x.organizacao_id = o.id)
       and not exists (select 1 from public.faturas x where x.organizacao_id = o.id and x.pago_em is not null)
  ),
  del as (
    delete from public.organizacoes o where o.id in (select alvo.id from alvo) returning o.id
  )
  select exists (select 1 from del)
$exclemp$;

revoke execute on function public.excluir_empresa(uuid) from public, anon;
grant execute on function public.excluir_empresa(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- BLOCO 3 — master não é administrador de empresa
-- ---------------------------------------------------------------------------
create or replace function public.email_eh_master(p_email text)
returns boolean language sql stable security definer set search_path = public as $emm$
  select exists (select 1 from public.plataforma_admins a where a.email_normalizado = lower(trim(p_email)))
$emm$;

revoke execute on function public.email_eh_master(text) from public, anon;
grant execute on function public.email_eh_master(text) to authenticated;

alter table public.organizacao_membros drop constraint if exists organizacao_membros_nao_master_ck;

alter table public.organizacao_membros add constraint organizacao_membros_nao_master_ck
  check (not public.email_eh_master(email)) not valid;

-- ---------------------------------------------------------------------------
-- BLOCO 4 — conferência: tem que voltar true nas três colunas.
-- ---------------------------------------------------------------------------
select exists (select 1 from pg_proc where proname = 'tg_organizacao_ultimo_socio'
                 and prosrc like '%from public.organizacoes o where o.id = old.organizacao_id%') as trava_corrigida,
       exists (select 1 from pg_proc where proname = 'excluir_empresa') as excluir_empresa,
       exists (select 1 from pg_constraint where conname = 'organizacao_membros_nao_master_ck') as master_fora_das_empresas;
