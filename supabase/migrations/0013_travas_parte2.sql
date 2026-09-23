-- 0013 — O que faltou da 0012
--
-- A 0012 entrou pela metade no SQL Editor do Supabase: `projeto_liberado` e
-- `papel_no_projeto` foram aplicados, e a execução parou em
-- `pode_administrar_projeto`. Diagnóstico por pg_proc/pg_policies:
--
--   fn_projeto_liberado 1 · fn_meu_acesso_suspenso 0 · papel_com_trava 1
--   pode_alterar_com_trava 0 · sigilo_despesas 0 · sigilo_etapas 0
--
-- Este arquivo repete só o que faltou. Cada instrução é curta e tem sua PRÓPRIA
-- etiqueta de dólar ($adm$, $lanc$…), para que nenhum separador de instruções
-- precise adivinhar onde um corpo termina.
--
-- Idempotente — rodar de novo não faz mal. Se ainda assim alguma parte falhar,
-- rode bloco a bloco: eles são independentes e podem ir em qualquer ordem.

-- ---------------------------------------------------------------------------
-- BLOCO 1 — escrever exige contrato em dia (inclusive para o dono)
-- ---------------------------------------------------------------------------
create or replace function public.pode_administrar_projeto(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $adm$
  select public.papel_no_projeto(p_projeto_id) in ('dono', 'admin')
     and public.projeto_liberado(p_projeto_id);
$adm$;

-- ---------------------------------------------------------------------------
-- BLOCO 2
-- ---------------------------------------------------------------------------
create or replace function public.pode_lancar(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $lanc$
  select public.papel_no_projeto(p_projeto_id) in ('dono', 'admin', 'manager', 'escritorio')
     and public.projeto_liberado(p_projeto_id);
$lanc$;

-- ---------------------------------------------------------------------------
-- BLOCO 3
-- ---------------------------------------------------------------------------
create or replace function public.pode_alterar(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $alt$
  select public.papel_no_projeto(p_projeto_id) in ('dono', 'admin', 'manager')
     and public.projeto_liberado(p_projeto_id);
$alt$;

-- ---------------------------------------------------------------------------
-- BLOCO 4 — a tela precisa saber para EXPLICAR a suspensão
-- ---------------------------------------------------------------------------
create or replace function public.meu_acesso_suspenso()
returns boolean language sql stable security definer set search_path = public as $susp$
  select exists (
    select 1 from public.projetos p
     where (p.owner_id = auth.uid()
            or exists (select 1 from public.projeto_membros m
                        where m.projeto_id = p.id
                          and m.email_normalizado = public.email_confirmado()))
       and not public.projeto_liberado(p.id)
  );
$susp$;

-- ---------------------------------------------------------------------------
-- BLOCO 5 — o sigilo do investidor (é este que ainda não está valendo)
-- ---------------------------------------------------------------------------
drop policy if exists despesas_ver on public.despesas;

create policy despesas_ver on public.despesas
  for select to authenticated
  using (public.pode_ver_projeto(projeto_id) and not public.eh_investidor(projeto_id));

drop policy if exists projeto_etapas_ver on public.projeto_etapas;

create policy projeto_etapas_ver on public.projeto_etapas
  for select to authenticated
  using (public.pode_ver_projeto(projeto_id) and not public.eh_investidor(projeto_id));

-- ---------------------------------------------------------------------------
-- BLOCO 6 — permissões de execução
-- ---------------------------------------------------------------------------
grant execute on function public.projeto_liberado(uuid) to authenticated;

grant execute on function public.meu_acesso_suspenso() to authenticated;
