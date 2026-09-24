-- 0021 — Documentos do cliente (CIS, LOI, ICPO, KYC…)
--
-- "No arquivo do cliente deverá ter um lugar para arquivar o CIS" — e com ele os
-- outros papéis que abrem e sustentam o cliente: LOI, ICPO, KYC, contrato social,
-- procuração. O arquivo vai para o Storage do Supabase (bucket PRIVADO); a
-- tabela guarda o que ele é, de quem é, quando foi emitido e até quando vale.
--
-- Caminho no bucket: <organizacao_id>/clientes/<cliente_id>/<uuid>-<nome>. A
-- PRIMEIRA pasta é a empresa, e é ela que as políticas conferem: só a
-- administração da empresa dona lê, envia ou apaga. Nenhuma política menciona
-- eh_master — o master não lê documento de cliente de ninguém.
--
-- Sem função nova. Idempotente. Depende de 0014. Teste: tests/schema12.test.sql.

-- ---------------------------------------------------------------------------
-- BLOCO 1 — tipo
-- ---------------------------------------------------------------------------
do $d1$ begin
  create type public.tipo_documento_cliente as enum
    ('cis', 'loi', 'icpo', 'kyc', 'contrato_social', 'procuracao', 'outro');
exception when duplicate_object then null; end $d1$;

-- ---------------------------------------------------------------------------
-- BLOCO 2 — tabela
-- ---------------------------------------------------------------------------
create table if not exists public.cliente_documentos (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  cliente_id     uuid not null,
  tipo           public.tipo_documento_cliente not null default 'cis',
  nome_arquivo   text not null check (char_length(nome_arquivo) between 1 and 200),
  -- Caminho no bucket; a primeira pasta TEM que ser a empresa (as políticas do
  -- Storage conferem por ela).
  caminho        text not null unique check (char_length(caminho) <= 500),
  tamanho        bigint check (tamanho is null or tamanho between 0 and 20971520),
  mime           text check (mime is null or char_length(mime) <= 120),
  emitido_em     date,
  validade       date,
  observacoes    text check (observacoes is null or char_length(observacoes) <= 1000),
  enviado_por    uuid default auth.uid(),
  criado_em      timestamptz not null default now(),
  -- restrict: cliente com documento arquivado não some junto com os papéis.
  constraint cliente_documentos_cliente_fk foreign key (cliente_id, organizacao_id)
    references public.clientes (id, organizacao_id) on delete restrict,
  constraint cliente_documentos_caminho_ck check (split_part(caminho, '/', 1) = organizacao_id::text),
  constraint cliente_documentos_datas_ck check (validade is null or emitido_em is null or validade >= emitido_em)
);

create index if not exists cliente_documentos_cliente_idx on public.cliente_documentos (cliente_id, tipo);

alter table public.cliente_documentos enable row level security;

drop policy if exists cliente_documentos_ver on public.cliente_documentos;

create policy cliente_documentos_ver on public.cliente_documentos for select to authenticated
  using (public.eh_admin_organizacao(organizacao_id));

drop policy if exists cliente_documentos_escrever on public.cliente_documentos;

create policy cliente_documentos_escrever on public.cliente_documentos for all to authenticated
  using (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id))
  with check (public.eh_admin_organizacao(organizacao_id) and public.empresa_ativa(organizacao_id));

grant select, insert, update, delete on public.cliente_documentos to authenticated;

drop trigger if exists historico_cliente_documentos on public.cliente_documentos;

create trigger historico_cliente_documentos after insert or update or delete on public.cliente_documentos
  for each row execute function public.tg_historico();

-- ---------------------------------------------------------------------------
-- BLOCO 3 — bucket privado (até 20 MB; PDF, imagem e Word)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 20971520,
        array['application/pdf', 'image/jpeg', 'image/png',
              'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- BLOCO 4 — quem lê e grava no bucket: a administração da empresa da 1ª pasta
-- ---------------------------------------------------------------------------
-- O `case` evita converter para uuid um nome que não seja uuid (a conversão
-- quebraria a consulta em vez de simplesmente negar).
drop policy if exists documentos_ler on storage.objects;

create policy documentos_ler on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.eh_admin_organizacao(((storage.foldername(name))[1])::uuid)
    else false end);

drop policy if exists documentos_enviar on storage.objects;

create policy documentos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.eh_admin_organizacao(((storage.foldername(name))[1])::uuid)
       and public.empresa_ativa(((storage.foldername(name))[1])::uuid)
    else false end);

drop policy if exists documentos_apagar on storage.objects;

create policy documentos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.eh_admin_organizacao(((storage.foldername(name))[1])::uuid)
       and public.empresa_ativa(((storage.foldername(name))[1])::uuid)
    else false end);

-- ---------------------------------------------------------------------------
-- BLOCO 5 — conferência: tem que voltar true nas três colunas.
-- ---------------------------------------------------------------------------
select to_regclass('public.cliente_documentos') is not null as tabela,
       exists (select 1 from storage.buckets where id = 'documentos' and not public) as bucket_privado,
       (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
          and policyname in ('documentos_ler', 'documentos_enviar', 'documentos_apagar')) = 3 as politicas_storage;
