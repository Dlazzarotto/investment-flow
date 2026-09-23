-- 0014 — Clientes e fornecedores (etapa 2 da reorganização)
--
-- São cadastros DA EMPRESA, não do projeto: o mesmo comprador aparece em vários
-- embarques, e o mesmo transportador serve a mais de uma rota. Repetir o
-- cadastro por projeto seria garantir que os dados divergem.
--
-- O fornecedor existe para o lançamento parar de ter descrição livre. Com ele,
-- o investidor lê "Logística · Rodoviário · US$ 2.400" e o nome fica do outro
-- lado da chave, onde o RLS não deixa ele chegar.
--
-- Blocos curtos e etiquetas próprias: o SQL Editor do Supabase truncou a 0010 e
-- a 0012 no meio. Se algum bloco falhar, os outros são independentes.
--
-- Idempotente. Depende de 0007 (organizacoes) e 0008 (grupo_custo, modal_etapa).

-- ---------------------------------------------------------------------------
-- BLOCO 1 — tipos
-- ---------------------------------------------------------------------------
do $t1$ begin
  create type public.tipo_cliente as enum ('investidor', 'comprador', 'vendedor', 'monetizador');
exception when duplicate_object then null; end $t1$;

-- ---------------------------------------------------------------------------
-- BLOCO 2 — clientes
-- ---------------------------------------------------------------------------
create table if not exists public.clientes (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  nome           text not null check (char_length(trim(nome)) between 1 and 160),
  -- Um cliente pode ser mais de uma coisa: quem compra também investe, e o
  -- monetizador às vezes é o mesmo grupo do comprador. Dois cadastros para a
  -- mesma pessoa é o caminho curto para os dados divergirem.
  tipos          public.tipo_cliente[] not null default '{}',
  documento      text check (documento is null or char_length(documento) <= 40),
  email          text check (email is null or char_length(email) <= 320),
  telefone       text check (telefone is null or char_length(telefone) <= 40),
  pais           text check (pais is null or char_length(pais) <= 80),
  endereco       text check (endereco is null or char_length(endereco) <= 300),
  observacoes    text check (observacoes is null or char_length(observacoes) <= 2000),
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists clientes_org_idx on public.clientes (organizacao_id, nome);

create unique index if not exists clientes_nome_uq
  on public.clientes (organizacao_id, lower(trim(nome)));

-- ---------------------------------------------------------------------------
-- BLOCO 3 — fornecedores
-- ---------------------------------------------------------------------------
create table if not exists public.fornecedores (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  nome           text not null check (char_length(trim(nome)) between 1 and 160),
  -- O que ele fornece, no MESMO vocabulário do custeio: assim o lançamento de
  -- custo herda serviço e tipo do fornecedor, sem tradução no meio.
  servico        public.grupo_custo not null default 'outros',
  -- Só faz sentido para quem transporta; null para os demais.
  modal          public.modal_etapa,
  documento      text check (documento is null or char_length(documento) <= 40),
  email          text check (email is null or char_length(email) <= 320),
  telefone       text check (telefone is null or char_length(telefone) <= 40),
  pais           text check (pais is null or char_length(pais) <= 80),
  observacoes    text check (observacoes is null or char_length(observacoes) <= 2000),
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists fornecedores_org_idx on public.fornecedores (organizacao_id, nome);

create unique index if not exists fornecedores_nome_uq
  on public.fornecedores (organizacao_id, lower(trim(nome)));

-- ---------------------------------------------------------------------------
-- BLOCO 4 — acesso
-- ---------------------------------------------------------------------------
-- Cadastro comercial é da administração da empresa. O investidor não chega aqui
-- por construção: ele nunca é membro de organização. Gerente e escritório
-- entram quando a permissão por módulo existir — hoje o papel é fixo, e liberar
-- por engano é pior do que liberar depois.
alter table public.clientes enable row level security;

alter table public.fornecedores enable row level security;

drop policy if exists clientes_empresa on public.clientes;

create policy clientes_empresa on public.clientes
  for all to authenticated
  using (public.eh_admin_organizacao(organizacao_id))
  with check (public.eh_admin_organizacao(organizacao_id));

drop policy if exists fornecedores_empresa on public.fornecedores;

create policy fornecedores_empresa on public.fornecedores
  for all to authenticated
  using (public.eh_admin_organizacao(organizacao_id))
  with check (public.eh_admin_organizacao(organizacao_id));

grant select, insert, update, delete on public.clientes to authenticated;

grant select, insert, update, delete on public.fornecedores to authenticated;

-- ---------------------------------------------------------------------------
-- BLOCO 5 — histórico (a trilha de auditoria vale para os cadastros novos)
-- ---------------------------------------------------------------------------
drop trigger if exists historico_clientes on public.clientes;

create trigger historico_clientes
  after insert or update or delete on public.clientes
  for each row execute function public.tg_historico();

drop trigger if exists historico_fornecedores on public.fornecedores;

create trigger historico_fornecedores
  after insert or update or delete on public.fornecedores
  for each row execute function public.tg_historico();
