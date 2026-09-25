-- 0032 — correções da auditoria de integração (idempotente; rodar em blocos se o
-- editor truncar). Cada bloco é independente e tem etiqueta de dólar própria.
--
--  1. Aviso de suspensão também para o ADM que não é dono de projeto e para o investidor.
--  2. Empresa suspensa não grava cadastro, administrador, capex nem projeto.
--  3. Gerente e escritório não enxergam capital: aportes e resumo_projeto sem investimento.
--  4. Resultado do projeto: só contratos na MOEDA do projeto; compra concluída é saída.
--     (Comissão de agente continua sendo da EMPRESA em qualquer conta — decisão da 0019.)
--  5. excluir_projeto recusa (false) com a empresa suspensa, em vez de quebrar num check.
--  6. Histórico dos cadastros e contratos ganha a empresa e o ADM passa a lê-lo.
--  7. excluir_empresa não apaga em cascata locais, grupos próprios e pesquisas.
--  8. Contrato convertido da 1ª versão: números travados; excluir leva a venda antiga junto.
--  9. Escritório lança no custeio como em despesas (alterar e excluir com PIN).

-- ---------------------------------------------------------------------------
-- BLOCO 1 — quem vê o aviso de suspensão
-- ---------------------------------------------------------------------------
create or replace function public.meu_acesso_suspenso()
returns boolean language sql stable security definer set search_path = public as $susp$
  select exists (
    select 1 from public.projetos p
     where (p.owner_id = auth.uid()
            or exists (select 1 from public.projeto_membros m
                        where m.projeto_id = p.id and m.email_normalizado = public.email_confirmado())
            or exists (select 1 from public.participantes pa
                        where pa.projeto_id = p.id and pa.email_normalizado = public.email_confirmado()))
       and not public.projeto_liberado(p.id)
  ) or exists (
    -- ADM da empresa, com ou sem projeto: é a empresa dele que está suspensa.
    select 1 from public.organizacao_membros m
     where m.email_normalizado = public.email_confirmado()
       and not public.empresa_ativa(m.organizacao_id)
  );
$susp$;

-- ---------------------------------------------------------------------------
-- BLOCO 2 — empresa suspensa não grava (políticas RESTRITIVAS, só na escrita)
-- ---------------------------------------------------------------------------
drop policy if exists clientes_em_dia_ins on public.clientes;
drop policy if exists clientes_em_dia_upd on public.clientes;
drop policy if exists clientes_em_dia_del on public.clientes;
create policy clientes_em_dia_ins on public.clientes as restrictive for insert with check (public.empresa_ativa(organizacao_id));
create policy clientes_em_dia_upd on public.clientes as restrictive for update using (public.empresa_ativa(organizacao_id));
create policy clientes_em_dia_del on public.clientes as restrictive for delete using (public.empresa_ativa(organizacao_id));

drop policy if exists fornecedores_em_dia_ins on public.fornecedores;
drop policy if exists fornecedores_em_dia_upd on public.fornecedores;
drop policy if exists fornecedores_em_dia_del on public.fornecedores;
create policy fornecedores_em_dia_ins on public.fornecedores as restrictive for insert with check (public.empresa_ativa(organizacao_id));
create policy fornecedores_em_dia_upd on public.fornecedores as restrictive for update using (public.empresa_ativa(organizacao_id));
create policy fornecedores_em_dia_del on public.fornecedores as restrictive for delete using (public.empresa_ativa(organizacao_id));

drop policy if exists commodities_em_dia_ins on public.commodities;
drop policy if exists commodities_em_dia_upd on public.commodities;
drop policy if exists commodities_em_dia_del on public.commodities;
create policy commodities_em_dia_ins on public.commodities as restrictive for insert with check (public.empresa_ativa(organizacao_id));
create policy commodities_em_dia_upd on public.commodities as restrictive for update using (public.empresa_ativa(organizacao_id));
create policy commodities_em_dia_del on public.commodities as restrictive for delete using (public.empresa_ativa(organizacao_id));

drop policy if exists commodity_parametros_em_dia_ins on public.commodity_parametros;
drop policy if exists commodity_parametros_em_dia_upd on public.commodity_parametros;
drop policy if exists commodity_parametros_em_dia_del on public.commodity_parametros;
create policy commodity_parametros_em_dia_ins on public.commodity_parametros as restrictive for insert
  with check (public.empresa_ativa(public.organizacao_da_commodity(commodity_id)));
create policy commodity_parametros_em_dia_upd on public.commodity_parametros as restrictive for update
  using (public.empresa_ativa(public.organizacao_da_commodity(commodity_id)));
create policy commodity_parametros_em_dia_del on public.commodity_parametros as restrictive for delete
  using (public.empresa_ativa(public.organizacao_da_commodity(commodity_id)));

-- O master continua gerindo administradores de empresa suspensa (é ele quem regulariza).
drop policy if exists organizacao_membros_em_dia_ins on public.organizacao_membros;
drop policy if exists organizacao_membros_em_dia_upd on public.organizacao_membros;
drop policy if exists organizacao_membros_em_dia_del on public.organizacao_membros;
create policy organizacao_membros_em_dia_ins on public.organizacao_membros as restrictive for insert
  with check (public.eh_master() or public.empresa_ativa(organizacao_id));
create policy organizacao_membros_em_dia_upd on public.organizacao_membros as restrictive for update
  using (public.eh_master() or public.empresa_ativa(organizacao_id));
create policy organizacao_membros_em_dia_del on public.organizacao_membros as restrictive for delete
  using (public.eh_master() or public.empresa_ativa(organizacao_id));

drop policy if exists investimentos_em_dia_ins on public.investimentos;
drop policy if exists investimentos_em_dia_upd on public.investimentos;
drop policy if exists investimentos_em_dia_del on public.investimentos;
create policy investimentos_em_dia_ins on public.investimentos as restrictive for insert with check (public.projeto_liberado(projeto_id));
create policy investimentos_em_dia_upd on public.investimentos as restrictive for update using (public.projeto_liberado(projeto_id));
create policy investimentos_em_dia_del on public.investimentos as restrictive for delete using (public.projeto_liberado(projeto_id));

drop policy if exists estimativas_ia_em_dia_ins on public.estimativas_ia;
drop policy if exists estimativas_ia_em_dia_upd on public.estimativas_ia;
drop policy if exists estimativas_ia_em_dia_del on public.estimativas_ia;
create policy estimativas_ia_em_dia_ins on public.estimativas_ia as restrictive for insert with check (public.projeto_liberado(projeto_id));
create policy estimativas_ia_em_dia_upd on public.estimativas_ia as restrictive for update using (public.projeto_liberado(projeto_id));
create policy estimativas_ia_em_dia_del on public.estimativas_ia as restrictive for delete using (public.projeto_liberado(projeto_id));

drop policy if exists projetos_em_dia_ins on public.projetos;
drop policy if exists projetos_em_dia_del on public.projetos;
create policy projetos_em_dia_ins on public.projetos as restrictive for insert with check (public.empresa_ativa(organizacao_id));
create policy projetos_em_dia_del on public.projetos as restrictive for delete using (public.projeto_liberado(id));

-- ---------------------------------------------------------------------------
-- BLOCO 3 — aportes: dono e admin veem todos; o investidor, só os dele;
-- gerente e escritório, nenhum (eles não enxergam capital — 0006)
-- ---------------------------------------------------------------------------
drop policy if exists aportes_ver on public.aportes;
create policy aportes_ver on public.aportes for select using (
  public.pode_ver_projeto(projeto_id)
  and (public.pode_ver_investimentos(projeto_id) or participante_id = public.participante_do_usuario(projeto_id))
);

-- ---------------------------------------------------------------------------
-- BLOCO 4 — resultado do projeto
--   * contratos só na moeda do projeto (somar USD num projeto em BRL dá um número
--     que não existe; a tela avisa os de outra moeda);
--   * venda concluída = receita; compra concluída = saída (custo) — por conta do
--     projeto, como principal, a preço fixo (intermediação é receita da empresa);
--   * gerente e escritório recebem investimento e aportes zerados.
-- ---------------------------------------------------------------------------
create or replace function public.resumo_projeto(p_projeto_id uuid)
returns table (
  investimento_total numeric, receita_total numeric, custo_vendas_total numeric, despesas_total numeric,
  saida_total numeric, saldo numeric, aportes_total numeric
)
language sql stable security definer set search_path = public as $resumo$
  with prj as (
    select p.moeda,
           public.papel_no_projeto(p.id) in ('manager', 'escritorio') as sem_capital
      from public.projetos p where p.id = p_projeto_id
  ),
  i as (select case when prj.sem_capital then 0 else coalesce(sum(x.valor_total), 0) end as v
          from prj left join public.investimentos x on x.projeto_id = p_projeto_id group by prj.sem_capital),
  v as (select coalesce(sum(x.receita_total), 0) as r, coalesce(sum(x.custo_total), 0) as c
          from public.vendas x where x.projeto_id = p_projeto_id),
  k as (
    select
      coalesce(sum(case when x.direcao = 'venda' then round(x.volume * x.preco_fixo, 2) end), 0) as r,
      coalesce(sum(case when x.direcao = 'compra' then round(x.volume * x.preco_fixo, 2) end), 0) as c
      from public.contratos x, prj
     where x.projeto_id = p_projeto_id and x.conta = 'projeto' and x.papel = 'principal' and x.status = 'concluido'
       and x.tipo_preco = 'fixo' and x.venda_origem_id is null and x.moeda = prj.moeda
  ),
  d as (select coalesce(sum(x.valor), 0) as v from public.despesas x where x.projeto_id = p_projeto_id),
  a as (select case when prj.sem_capital then 0 else coalesce(sum(x.valor), 0) end as v
          from prj left join public.aportes x on x.projeto_id = p_projeto_id group by prj.sem_capital)
  select i.v, v.r + k.r, v.c + k.c, d.v, i.v + v.c + k.c + d.v, v.r + k.r - (i.v + v.c + k.c + d.v), a.v
    from i, v, k, d, a
   where public.pode_ver_projeto(p_projeto_id)
$resumo$;

-- ---------------------------------------------------------------------------
-- BLOCO 5 — excluir projeto com a empresa suspensa devolve false (a tela explica)
-- ---------------------------------------------------------------------------
create or replace function public.excluir_projeto(p_projeto_id uuid)
returns boolean language sql set search_path = public as $excl$
  with dono as (
    select p.id from public.projetos p
     where p.id = p_projeto_id and p.owner_id = auth.uid() and public.projeto_liberado(p.id)
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
$excl$;

-- ---------------------------------------------------------------------------
-- BLOCO 6 — histórico: a linha sem projeto leva a empresa da própria tabela
-- ---------------------------------------------------------------------------
create or replace function public.tg_historico()
returns trigger language plpgsql security definer set search_path = public as $hist$
declare
  v_antes jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_depois jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_linha jsonb := coalesce(v_depois, v_antes);
  v_coluna text := tg_argv[0];
  v_projeto uuid;
  v_org uuid;
  v_mudou jsonb;
begin
  if v_coluna is not null and v_linha ? v_coluna then
    v_projeto := (v_linha ->> v_coluna)::uuid;
    select p.organizacao_id into v_org from public.projetos p where p.id = v_projeto;
  end if;
  if v_org is null and v_linha ? 'organizacao_id' then
    v_org := (v_linha ->> 'organizacao_id')::uuid;
  end if;
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, v_depois -> k) into v_mudou
      from jsonb_object_keys(v_depois) k
     where v_depois -> k is distinct from v_antes -> k;
    if v_mudou is null then return null; end if;
    v_antes := (select jsonb_object_agg(k, v_antes -> k) from jsonb_object_keys(v_mudou) k);
    v_depois := v_mudou;
  end if;
  insert into public.historico (organizacao_id, projeto_id, tabela, registro_id, acao, ator, ator_email, antes, depois)
  values (v_org, v_projeto, tg_table_name, (v_linha ->> 'id')::uuid, lower(tg_op),
          auth.uid(), public.email_confirmado(), v_antes, v_depois);
  return null;
end
$hist$;

-- O que já foi gravado sem empresa: recupera pelo próprio registro, quando ele traz a coluna.
update public.historico h
   set organizacao_id = coalesce(h.depois ->> 'organizacao_id', h.antes ->> 'organizacao_id')::uuid
 where h.organizacao_id is null
   and coalesce(h.depois ->> 'organizacao_id', h.antes ->> 'organizacao_id') is not null;

drop policy if exists historico_ver_empresa on public.historico;
create policy historico_ver_empresa on public.historico for select
  using (organizacao_id is not null and public.eh_admin_organizacao(organizacao_id));

-- ---------------------------------------------------------------------------
-- BLOCO 7 — empresa "vazia" é vazia de verdade
-- ---------------------------------------------------------------------------
create or replace function public.excluir_empresa(p_organizacao_id uuid)
returns boolean language sql security definer set search_path = public as $exe$
  with alvo as (
    select o.id from public.organizacoes o
     where o.id = p_organizacao_id and public.eh_master()
       and not exists (select 1 from public.projetos x where x.organizacao_id = o.id)
       and not exists (select 1 from public.clientes x where x.organizacao_id = o.id)
       and not exists (select 1 from public.fornecedores x where x.organizacao_id = o.id)
       and not exists (select 1 from public.commodities x where x.organizacao_id = o.id)
       and not exists (select 1 from public.contratos x where x.organizacao_id = o.id)
       and not exists (select 1 from public.locais x where x.organizacao_id = o.id)
       and not exists (select 1 from public.commodity_grupos x where x.organizacao_id = o.id)
       and not exists (select 1 from public.pesquisas_mercado x where x.organizacao_id = o.id)
       and not exists (select 1 from public.faturas x where x.organizacao_id = o.id and x.pago_em is not null)
  ),
  del as (
    delete from public.organizacoes o where o.id in (select alvo.id from alvo) returning o.id
  )
  select exists (select 1 from del)
$exe$;

-- ---------------------------------------------------------------------------
-- BLOCO 8 — contrato convertido da 1ª versão (0022)
-- resumo_projeto lê a VENDA antiga, não o contrato. Mudar volume, preço, moeda,
-- conta… no contrato mudaria as listas e não o resultado. Então: trava; e excluir
-- o contrato leva a venda antiga junto, para a receita sair do projeto também.
-- ---------------------------------------------------------------------------
create or replace function public.tg_contrato_convertido()
returns trigger language plpgsql security definer set search_path = public as $cv$
begin
  if tg_op = 'UPDATE' then
    if (new.volume, new.unidade, new.preco_fixo, new.tipo_preco, new.moeda, new.conta, new.projeto_id,
        new.direcao, new.papel, new.status)
       is distinct from
       (old.volume, old.unidade, old.preco_fixo, old.tipo_preco, old.moeda, old.conta, old.projeto_id,
        old.direcao, old.papel, old.status) then
      raise exception 'contrato_convertido: os números deste contrato vêm de uma venda da 1ª versão'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;
  delete from public.vendas v where v.id = old.venda_origem_id;
  return old;
end
$cv$;

drop trigger if exists contrato_convertido_trava on public.contratos;
create trigger contrato_convertido_trava before update on public.contratos
  for each row when (old.venda_origem_id is not null) execute function public.tg_contrato_convertido();
drop trigger if exists contrato_convertido_exclui on public.contratos;
create trigger contrato_convertido_exclui after delete on public.contratos
  for each row when (old.venda_origem_id is not null) execute function public.tg_contrato_convertido();

-- ---------------------------------------------------------------------------
-- BLOCO 9 — custeio: escritório lança; alterar e excluir com PIN (como despesas)
-- ---------------------------------------------------------------------------
drop policy if exists projeto_etapas_escrever on public.projeto_etapas;
drop policy if exists projeto_etapas_lancar on public.projeto_etapas;
drop policy if exists projeto_etapas_alterar on public.projeto_etapas;
drop policy if exists projeto_etapas_excluir on public.projeto_etapas;
create policy projeto_etapas_lancar on public.projeto_etapas for insert with check (public.pode_lancar(projeto_id));
create policy projeto_etapas_alterar on public.projeto_etapas for update
  using (public.pode_alterar(projeto_id) or (public.pode_lancar(projeto_id) and public.tem_autorizacao(projeto_id)))
  with check (public.pode_alterar(projeto_id) or (public.pode_lancar(projeto_id) and public.tem_autorizacao(projeto_id)));
create policy projeto_etapas_excluir on public.projeto_etapas for delete
  using (public.pode_alterar(projeto_id) or (public.pode_lancar(projeto_id) and public.tem_autorizacao(projeto_id)));

drop policy if exists estimativas_custo_escrever on public.estimativas_custo;
drop policy if exists estimativas_custo_lancar on public.estimativas_custo;
drop policy if exists estimativas_custo_alterar on public.estimativas_custo;
drop policy if exists estimativas_custo_excluir on public.estimativas_custo;
create policy estimativas_custo_lancar on public.estimativas_custo for insert with check (public.pode_lancar(projeto_id));
create policy estimativas_custo_alterar on public.estimativas_custo for update
  using (public.pode_alterar(projeto_id) or (public.pode_lancar(projeto_id) and public.tem_autorizacao(projeto_id)))
  with check (public.pode_alterar(projeto_id) or (public.pode_lancar(projeto_id) and public.tem_autorizacao(projeto_id)));
create policy estimativas_custo_excluir on public.estimativas_custo for delete
  using (public.pode_alterar(projeto_id) or (public.pode_lancar(projeto_id) and public.tem_autorizacao(projeto_id)));

drop policy if exists estimativa_itens_escrever on public.estimativa_itens;
drop policy if exists estimativa_itens_lancar on public.estimativa_itens;
drop policy if exists estimativa_itens_alterar on public.estimativa_itens;
drop policy if exists estimativa_itens_excluir on public.estimativa_itens;
create policy estimativa_itens_lancar on public.estimativa_itens for insert
  with check (public.pode_lancar(public.projeto_da_estimativa(estimativa_id)));
create policy estimativa_itens_alterar on public.estimativa_itens for update
  using (public.pode_alterar(public.projeto_da_estimativa(estimativa_id))
         or (public.pode_lancar(public.projeto_da_estimativa(estimativa_id)) and public.tem_autorizacao(public.projeto_da_estimativa(estimativa_id))))
  with check (public.pode_alterar(public.projeto_da_estimativa(estimativa_id))
         or (public.pode_lancar(public.projeto_da_estimativa(estimativa_id)) and public.tem_autorizacao(public.projeto_da_estimativa(estimativa_id))));
create policy estimativa_itens_excluir on public.estimativa_itens for delete
  using (public.pode_alterar(public.projeto_da_estimativa(estimativa_id))
         or (public.pode_lancar(public.projeto_da_estimativa(estimativa_id)) and public.tem_autorizacao(public.projeto_da_estimativa(estimativa_id))));

-- ---------------------------------------------------------------------------
-- BLOCO 10 — conferência: tem que voltar true em todas as colunas.
-- ---------------------------------------------------------------------------
select
  (select count(*) from pg_policies where schemaname = 'public' and policyname like '%\_em\_dia\_%') = 23 as travas_suspensao,
  exists (select 1 from pg_policies where tablename = 'aportes' and policyname = 'aportes_ver'
           and qual like '%pode_ver_investimentos%') as aportes_sem_gerente,
  (select prosrc like '%sem_capital%' and prosrc like '%direcao = ''compra''%' from pg_proc where proname = 'resumo_projeto') as resumo_projeto,
  (select prosrc like '%projeto_liberado%' from pg_proc where proname = 'excluir_projeto') as excluir_projeto,
  (select prosrc like '%v_linha ? ''organizacao_id''%' from pg_proc where proname = 'tg_historico') as historico,
  (select prosrc like '%public.locais%' from pg_proc where proname = 'excluir_empresa') as excluir_empresa,
  (select count(*) from pg_trigger where tgname like 'contrato_convertido_%') = 2 as contrato_convertido,
  (select count(*) from pg_policies where policyname in ('projeto_etapas_lancar', 'estimativas_custo_lancar', 'estimativa_itens_lancar')) = 3 as custeio_escritorio;
