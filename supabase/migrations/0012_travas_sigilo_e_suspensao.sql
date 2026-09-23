-- 0012 — As duas travas que foram decididas e nunca aplicadas
--
-- Achados 1 e 2 da auditoria. Os dois nasceram do mesmo erro: a regra foi
-- decidida, escrita no documento da reorganização, e o BANCO NUNCA RECEBEU A
-- TRAVA. Decisão registrada não é decisão aplicada.
--
--   1. Empresa suspensa ou com vigência vencida continuava operando. O
--      interruptor que sustenta cobrar assinatura existia só como número de
--      painel: `empresa_ativa()` não aparecia em policy nenhuma.
--   2. O investidor lia a descrição livre das despesas. `pode_ver_projeto()`
--      devolve verdadeiro para qualquer papel, e a policy de despesas usava
--      ela — "Frete — Transportadora Silva" ficava visível para ele.
--
-- Idempotente. Depende de 0009. Delimitador nomeado ($fn$), não $$.

-- ---------------------------------------------------------------------------
-- 1. Empresa suspensa: equipe fora, dono em leitura, ninguém escreve
-- ---------------------------------------------------------------------------
--
-- Bloquear TODO MUNDO, inclusive o dono, seria segurar o dado do cliente como
-- refém numa discussão de pagamento — e o dono, na prática, é o próprio ADM,
-- então a suspensão pegaria justo quem precisa ver a conta para regularizar.
-- Abrir exceção para ele sem mais nada faria o interruptor não interromper
-- nada, já que é ele quem opera.
--
-- O meio-termo é o que os SaaS fazem: a empresa suspensa fica em SOMENTE
-- LEITURA para o dono, e fechada para o resto da equipe. Não se opera, não se
-- lança, não se altera — e ninguém perde o acesso ao próprio histórico.

/**
 * A empresa DO PROJETO está em dia?
 *
 * Projeto sem organização (os que existem desde antes da v4) responde `true`:
 * cortar o acesso deles agora seria trocar um defeito por outro pior.
 */
create or replace function public.projeto_liberado(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select coalesce((
    select o.ativa and (o.vigencia_ate is null or o.vigencia_ate >= current_date)
      from public.projetos p
      join public.organizacoes o on o.id = p.organizacao_id
     where p.id = p_projeto_id
  ), true);
$fn$;

/**
 * Papel no projeto, agora respeitando o contrato da empresa.
 *
 * A trava fica AQUI e não em cada policy: esta função é a raiz de
 * `pode_ver_projeto`, `pode_alterar`, `pode_lancar` e das demais. Uma linha
 * aqui suspende a equipe inteira de uma vez, e nenhuma policy futura pode
 * esquecer de checar.
 */
create or replace function public.papel_no_projeto(p_projeto_id uuid)
returns text language sql stable security definer set search_path = public as $fn$
  select case
    -- O dono continua entrando, mas só lê: ver a própria conta para regularizar
    -- não pode depender de estar em dia.
    when exists (select 1 from public.projetos p
                  where p.id = p_projeto_id and p.owner_id = auth.uid()) then 'dono'
    -- Daqui para baixo, empresa fora do contrato não tem ninguém dentro.
    when not public.projeto_liberado(p_projeto_id) then null
    when exists (select 1 from public.projetos p
                  where p.id = p_projeto_id and p.organizacao_id is not null
                    and public.eh_admin_organizacao(p.organizacao_id)) then 'admin'
    when exists (select 1 from public.projeto_membros m
                  where m.projeto_id = p_projeto_id
                    and m.email_normalizado = public.email_confirmado())
      then (select m.papel::text from public.projeto_membros m
             where m.projeto_id = p_projeto_id
               and m.email_normalizado = public.email_confirmado()
             limit 1)
    when exists (select 1 from public.participantes pp
                  where pp.projeto_id = p_projeto_id
                    and pp.email_normalizado = public.email_confirmado()) then 'investidor'
    else null
  end;
$fn$;

-- Escrever exige contrato em dia — inclusive para o dono. É isto que faz a
-- suspensão valer alguma coisa sem trancar ninguém fora do próprio histórico.
create or replace function public.pode_administrar_projeto(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.papel_no_projeto(p_projeto_id) in ('dono', 'admin')
     and public.projeto_liberado(p_projeto_id);
$fn$;

create or replace function public.pode_lancar(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.papel_no_projeto(p_projeto_id) in ('dono', 'admin', 'manager', 'escritorio')
     and public.projeto_liberado(p_projeto_id);
$fn$;

create or replace function public.pode_alterar(p_projeto_id uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.papel_no_projeto(p_projeto_id) in ('dono', 'admin', 'manager')
     and public.projeto_liberado(p_projeto_id);
$fn$;

/**
 * Meu acesso está suspenso? A tela precisa saber para explicar.
 *
 * Sem isto, a suspensão aparece como lista de projetos vazia e o cliente pensa
 * que perdeu os dados — gerando o telefonema que a mensagem certa evita.
 */
create or replace function public.meu_acesso_suspenso()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.projetos p
     where (p.owner_id = auth.uid()
            or exists (select 1 from public.projeto_membros m
                        where m.projeto_id = p.id
                          and m.email_normalizado = public.email_confirmado()))
       and not public.projeto_liberado(p.id)
  );
$fn$;

-- ---------------------------------------------------------------------------
-- 2. O investidor vê números, nunca nomes
-- ---------------------------------------------------------------------------

/**
 * Despesa: o investidor perde o acesso à linha inteira.
 *
 * Não dá para esconder só a coluna `descricao` — o RLS filtra LINHA, não campo.
 * Ele continua vendo o total de despesas pelo `resumo_projeto()`, que é
 * security definer e devolve soma, não texto. O extrato detalhado volta para
 * ele quando o lançamento passar a apontar para um cadastro de fornecedor
 * (serviço, tipo, valor), como decidido na reorganização.
 */
drop policy if exists despesas_ver on public.despesas;
create policy despesas_ver on public.despesas
  for select to authenticated
  using (public.pode_ver_projeto(projeto_id) and not public.eh_investidor(projeto_id));

/**
 * Cadeia logística: origem, destino e país de cada etapa dizem de quem se
 * compra e por onde se escoa. Em 0008 isso foi liberado a todo mundo do
 * projeto — decisão anterior à regra de sigilo, que agora prevalece.
 */
drop policy if exists projeto_etapas_ver on public.projeto_etapas;
create policy projeto_etapas_ver on public.projeto_etapas
  for select to authenticated
  using (public.pode_ver_projeto(projeto_id) and not public.eh_investidor(projeto_id));

grant execute on function public.projeto_liberado(uuid) to authenticated;
grant execute on function public.meu_acesso_suspenso() to authenticated;
