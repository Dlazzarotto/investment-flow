-- 0010 — O master opera as empresas
--
-- A 0009 deu ao master o direito de VER a empresa e mexer no contrato dela.
-- Faltava o que ele mais faz: criar a empresa e sentar o ADM nela. A policy
-- organizacao_membros_gerir (0007) só atende quem já é admin da organização —
-- e o master, por desenho, nunca é admin de organização nenhuma.
--
-- Continua valendo o limite: nada aqui deixa o master ler projeto, custo,
-- cliente ou documento. Ele mexe em quem entra, não no que se faz lá dentro.
--
-- Idempotente. Depende de 0009.

-- O master sobe e remove membros — é assim que o ADM da empresa é nomeado.
drop policy if exists organizacao_membros_master_gerir on public.organizacao_membros;
create policy organizacao_membros_master_gerir on public.organizacao_membros
  for all to authenticated
  using (public.eh_master())
  with check (public.eh_master());

/**
 * Cria a empresa já com o ADM sentado, numa transação só.
 *
 * Não dá para o master fazer isso por dois inserts da aplicação: a empresa
 * nasceria sem dono se o segundo falhasse, e `criar_organizacao()` (0007) põe
 * QUEM CHAMA como membro — o que faria o master virar admin da empresa do
 * cliente, exatamente o que a decisão de não-leitura quer evitar.
 */
create or replace function public.criar_empresa(
  p_nome text,
  p_email_adm text,
  p_plano public.plano_empresa default 'avaliacao',
  p_assentos int default null,
  p_vigencia_ate date default null
) returns uuid language plpgsql security definer set search_path = public as $criar_empresa$
declare
  v_id uuid;
  v_email text := lower(trim(p_email_adm));
begin
  if not public.eh_master() then
    raise exception 'Somente a administração da plataforma libera empresas.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_email is null or position('@' in v_email) < 2 then
    raise exception 'Informe o e-mail do administrador da empresa.' using errcode = 'check_violation';
  end if;

  insert into public.organizacoes (nome, plano, assentos, vigencia_ate)
  values (trim(p_nome), p_plano, p_assentos, p_vigencia_ate)
  returning id into v_id;

  insert into public.organizacao_membros (organizacao_id, email) values (v_id, v_email);
  return v_id;
end $criar_empresa$;

/**
 * O painel do master: uma linha por empresa, com o contrato e o uso.
 *
 * Devolve contagem, nunca conteúdo — quantos projetos existem, não quais.
 * Security definer para ler organizacao_membros e projetos sem dar ao master
 * acesso de leitura a essas tabelas.
 */
create or replace function public.empresas_da_plataforma()
returns table (id uuid, nome text, plano public.plano_empresa, assentos int, ativa boolean, vigencia_ate date, em_dia boolean, assentos_usados int, projetos int, admins text[], criado_em timestamptz) language plpgsql security definer set search_path = public as $empresas$
begin
  if not public.eh_master() then
    raise exception 'Somente a administração da plataforma vê este painel.'
      using errcode = 'insufficient_privilege';
  end if;
  return query
    select o.id, o.nome, o.plano, o.assentos, o.ativa, o.vigencia_ate,
           public.empresa_ativa(o.id),
           public.assentos_ocupados(o.id),
           (select count(*)::int from public.projetos p where p.organizacao_id = o.id),
           coalesce((select array_agg(m.email order by m.criado_em)
                       from public.organizacao_membros m where m.organizacao_id = o.id), '{}'::text[]),
           o.criado_em
      from public.organizacoes o
     order by o.criado_em desc;
end $empresas$;

grant execute on function public.criar_empresa(text, text, public.plano_empresa, int, date) to authenticated;
grant execute on function public.empresas_da_plataforma() to authenticated;
