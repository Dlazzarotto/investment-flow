-- 0025 — Conta avulsa não ganha empresa nem projeto
--
-- A tela de entrada não oferece "criar conta" (acesso é por convite ou pelo link
-- que o master manda ao ADM), mas /criar-conta continua existindo — é por ela que
-- o convidado entra — e a chave pública do Supabase está no navegador. Então
-- qualquer um podia abrir uma conta e:
--   1. chamar criar_organizacao() (0007) e sair com uma EMPRESA ATIVA, sem passar
--      pelo master — o contrário de "o master libera empresas";
--   2. criar projetos soltos, fora de qualquer empresa (a 0019 aceitava
--      organizacao_id vazio).
-- E corrige a trava de update da 0019, que desde a 0022 impedia o admin do
-- projeto de editar o próprio projeto (bloco 3).
--
-- Depois desta migration, conta sem convite é uma conta vazia: não cria empresa,
-- não cria projeto, não vê nada. Empresa só nasce por criar_empresa() (master).
-- Projeto só nasce dentro da empresa de quem grava (o trigger da 0007 preenche a
-- empresa antes da checagem).
--
-- Uma função SQL de uma instrução (bloco 3), sem PL/pgSQL. Idempotente. Teste: tests/schema15.test.sql.

-- ---------------------------------------------------------------------------
-- BLOCO 1 — ninguém cria a própria empresa (função existe, mas ninguém executa)
-- ---------------------------------------------------------------------------
-- Função nasce com EXECUTE para PUBLIC; revogar só de authenticated não bastaria.
revoke execute on function public.criar_organizacao(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- BLOCO 2 — projeto novo só dentro da empresa de quem grava
-- ---------------------------------------------------------------------------
drop policy if exists projetos_empresa_propria on public.projetos;

create policy projetos_empresa_propria on public.projetos as restrictive
  for insert to authenticated
  with check (organizacao_id is not null and public.eh_admin_organizacao(organizacao_id));

-- ---------------------------------------------------------------------------
-- BLOCO 3 — editar projeto: a trava é contra MUDAR de empresa, não contra editar
-- ---------------------------------------------------------------------------
-- A 0019 exigia ser ADM da empresa do projeto para QUALQUER update. Desde a 0022
-- todo projeto tem empresa, então o admin do projeto (projeto_membros, sem ser da
-- empresa) não conseguia mais mudar nem o nome ou o status. Agora: manter a
-- empresa que já está gravada é livre; trocar exige ser ADM da empresa de destino.
-- A função lê a linha como estava antes do update (mesmo snapshot da instrução)
-- e é security definer para a policy não consultar projetos por dentro dela mesma.
create or replace function public.organizacao_do_projeto(p_projeto_id uuid)
returns uuid language sql stable security definer set search_path = public as $orgp$
  select p.organizacao_id from public.projetos p where p.id = p_projeto_id
$orgp$;

revoke execute on function public.organizacao_do_projeto(uuid) from public, anon;
grant execute on function public.organizacao_do_projeto(uuid) to authenticated;

drop policy if exists projetos_empresa_propria_alterar on public.projetos;

create policy projetos_empresa_propria_alterar on public.projetos as restrictive
  for update to authenticated
  using (true)
  with check (organizacao_id is null
              or organizacao_id is not distinct from public.organizacao_do_projeto(id)
              or public.eh_admin_organizacao(organizacao_id));

-- ---------------------------------------------------------------------------
-- BLOCO 4 — conferência: tem que voltar true nas três colunas.
-- ---------------------------------------------------------------------------
select not has_function_privilege('authenticated', 'public.criar_organizacao(text)', 'execute') as sem_empresa_avulsa,
       exists (select 1 from pg_policies where tablename = 'projetos' and policyname = 'projetos_empresa_propria'
                 and with_check like '%organizacao_id IS NOT NULL%') as projeto_so_na_empresa,
       exists (select 1 from pg_policies where tablename = 'projetos' and policyname = 'projetos_empresa_propria_alterar'
                 and with_check like '%organizacao_do_projeto%') as admin_do_projeto_edita;
