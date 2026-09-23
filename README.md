# Gestão de Aportes — Next.js + Supabase + Vercel (v3.0)

Investimentos (Capex/Opex), vendas/receitas, parceria (tipo + participação %) e dashboard
por projeto. Reescrita da v1 (Streamlit/SQLite) na stack Next.js 14 · TypeScript · Supabase · Vercel.

## Estrutura

```
supabase/migrations/0001_schema.sql   # enums, tabelas, colunas geradas, trigger ≤100 %, RLS, fluxo_mensal()
supabase/migrations/0002_estimativas_ia.sql  # estimativas de valor médio (IA), RLS, ultimas_estimativas()
supabase/migrations/0003_participacao_lock.sql # trava de 100 % com lock na linha do projeto (sem corrida)
supabase/migrations/0004_projeto_membros.sql # acesso de sócios: projeto_membros, papel leitor/editor, RLS por membro
supabase/migrations/0005_custos_e_despesas.sql # custo direto da venda (coluna gerada), tabela despesas, fluxo com saída
supabase/migrations/0006_papeis_pin_convites.sql # papéis admin/manager/escritório, PIN de autorização, convites por link
supabase/migrations/0007_investidores_aportes.sql # organização dos sócios, papel investidor, aportes, carteira
app/
  login/                              # e-mail + senha (Supabase Auth)
  convite/[token]/                    # entrada pelo link de convite (um clique, não a visita)
  projetos/page.tsx                   # lista + criar projeto (nome, moeda, tipo de parceria, sua %)
  projetos/[id]/layout.tsx            # shell com seletor global de projeto e abas
  projetos/[id]/page.tsx              # dashboard: saldo, KPIs (ROI, margem bruta, saída, TIR), 3 gráficos, rateio, cenários, tabela mensal
  projetos/[id]/investimentos/        # formulário + tabela com edição na linha e exclusão
  projetos/[id]/vendas/               # formulário + tabela com edição na linha, custo direto e margem
  projetos/[id]/despesas/             # custeio do projeto: formulário, tabela editável e resumo por categoria
  projetos/[id]/participantes/        # estrutura da parceria, participantes, acesso de sócios, exclusão do projeto
  projetos/[id]/aportes/              # como cada participante entrou: dinheiro, maquinário, crédito, serviço…
  carteira/                           # visão do investidor: seus projetos, seus aportes e o saldo atribuível
  api/export/[id]/route.ts            # ?formato=csv (separador/decimal do idioma) | xlsx (7 abas, inclui Cenários e Estimativas IA)
  api/ia/estimar/route.ts             # POST — valor médio de mercado do item via Claude API + busca na web
  actions/                            # server actions (zod → Supabase → revalidate)
lib/                                  # types, validacao (zod, mensagens traduzidas), calculos, format (por idioma), csv (por idioma), consultas, supabase/
lib/i18n/                             # config (pt/en/es/zh), dicionarios/*.ts, server.ts (cookie/Accept-Language), client.tsx (provider)
components/                           # Shell, seletor, nav, Cenarios, forms, tabelas (edição inline), charts (Recharts), ui
tests/calculos.test.ts                # 33 testes (vitest): KPIs, custo/margem da venda, break-even, rateio, ROI anualizado, TIR/VPL, cenários, zod
tests/ia.test.ts                      # 14 testes: parser tolerante da resposta da IA (corta o longo, descarta fonte inválida), prompt, desvio
tests/i18n.test.ts                    # 10 testes: paridade de chaves/placeholders nos 4 idiomas, Intl por locale, mensagens traduzidas
tests/csv.test.ts                     # 6 testes: separador e decimal por idioma, aspas, BOM, diretiva sep=
tests/schema.test.sql                 # testes do banco (psql): colunas geradas, fluxo mensal, trava 100 %, RLS, cascata
tests/schema2.test.sql                # testes da migration 0002
tests/schema3.test.sql                # testes da migration 0003 (trava preservada; roteiro de concorrência)
tests/schema4.test.sql                # testes da migration 0004 (leitor, editor, e-mail não confirmado, revogação)
tests/schema5.test.sql                # testes da migration 0005 (custo gerado, despesas, fluxo com as três saídas)
tests/schema6.test.sql                # testes da migration 0006 (papéis, PIN, trava de tentativas, convites)
tests/schema7.test.sql                # testes da migration 0007 (organização, investidor, aportes, carteira)
```

## Idiomas (pt · en · es · zh)

- Detecção automática pelo `Accept-Language` na primeira visita (cookie `idioma`); seletor no cabeçalho e na tela de login.
- Um único dicionário por idioma em `lib/i18n/dicionarios/`; `pt.ts` define o tipo e os demais são checados pelo TypeScript e por teste (mesmas chaves e mesmos placeholders).
- Tudo é traduzido: telas, formulários, validações zod, erros do banco, enums, gráficos, exportação (abas e cabeçalhos), `<html lang>` e o idioma das premissas/observações geradas pela IA. Moeda, número, data e mês seguem o `Intl` do idioma.

## Acesso ao projeto

- O dono é quem criou o projeto (`projetos.owner_id`). Só ele exclui o projeto; no resto, o **admin** faz o mesmo.
- `projeto_membros` guarda quem mais entra, com um de três papéis:

| Papel | Vê investimentos | Lança venda/despesa | Altera e exclui | Convida, parceria, PIN |
|---|---|---|---|---|
| admin | sim | sim | sim | sim |
| manager | **não** | sim | sim | não |
| escritorio | **não** | sim | **só com o PIN** | não |
| investidor | **não** | **não** | **não** | não |

O **investidor** entra pelo e-mail cadastrado na própria linha de `participantes` e só lê o que é dele: a
própria participação e os próprios aportes, além das vendas e despesas do projeto (o retorno dele depende
disso). Não vê investimentos, nem a lista de acessos, nem a divisão dos outros participantes.

Os **sócios da organização** (`organizacoes` / `organizacao_membros`) são `admin` em todo projeto vinculado
a ela, sem convite projeto a projeto.

- **PIN de autorização:** é do projeto, cadastrado pelo admin, guardado com bcrypt e nunca lido de volta. Não é
  a senha de login de ninguém. Acertar abre uma janela de poucos minutos; cinco erros em 15 minutos travam as
  tentativas. Sem PIN cadastrado, o Escritório não altera nem exclui nada.
- **Convite por link:** `/convite/[token]` com papel embutido, validade, número de usos e revogação. O banco
  guarda só o sha256 do token — o link não é recuperável depois de gerado.
- Como o manager não enxerga investimentos, o fluxo mensal dele vem sem o capex: o saldo que ele vê é o
  **resultado operacional**, e o ROI sai da tela porque o denominador é justamente o investimento.
- O RLS decide por `pode_ver_projeto()` / `pode_editar_projeto()`, que casam o e-mail **confirmado** da conta
  (`auth.users.email_confirmed_at`) com a lista de membros. A tela pergunta o papel ao banco
  (`papel_no_projeto()`), então nunca mostra um botão que o RLS vai recusar.
- Remover o membro corta o acesso na hora; excluir o projeto leva os membros junto (cascata).

## Modelo de parceria

- `projetos.tipo_parceria`: **sociedade_direta** · **joint_venture** · **investidor**
- `projetos.participacao_pct`: a sua participação no projeto (0–100)
- `participantes`: demais partes (sócio, parceiro da JV, investidor, operador) com `percentual`
- Trigger no banco: `participacao_pct + Σ percentual ≤ 100` (a UI mostra alocado/disponível)
- Dashboard e Excel mostram o resultado (saldo, investimento, receita) **atribuível a cada parte**

## Valor médio de mercado com IA

- No formulário de investimento, "Estimar valor médio" envia item + contexto opcional para `/api/ia/estimar`.
- O servidor chama a Claude Messages API com a ferramenta `web_search` (até 5 buscas), exige JSON
  (mín / médio / máx, unidade de referência, confiança, premissas, fontes) e valida com zod antes de gravar.
- O parser é tolerante de propósito: texto longo demais é cortado e fonte com link quebrado é descartada —
  só os números derrubam a estimativa, e com mensagem traduzida. Um detalhe de forma não pode jogar fora
  uma faixa de preço boa.
- A estimativa fica em `estimativas_ia`; a tabela de investimentos mostra a última média por item e o desvio
  do valor lançado (vermelho > +15 %, verde < −15 %). O Excel ganha a aba "Estimativas IA".
- Requisitos: `ANTHROPIC_API_KEY` no servidor (Vercel → Environment Variables) e busca na web habilitada
  para a organização no Console da Anthropic. Sem a chave, o recurso fica oculto e o resto do sistema funciona.

## O que entra e o que sai

- **Entrada:** `vendas.receita_total` (volume × preço), coluna gerada.
- **Saídas**, três, somadas em `saida`:
  - `investimentos` — capital aportado (Capex/Opex de aporte)
  - `vendas.custo_total` — custo direto do embarque, coluna gerada: mercadoria e frete por unidade de
    volume, mais impostos/royalties e comissão como % da receita
  - `despesas` — custeio que não se liga a uma venda (folha, manutenção, combustível, arrendamento…)
- **Margem bruta** = receita − custo direto das vendas. **Saldo** = receita − saída total.
- **ROI** continua sendo saldo ÷ investimento: retorno sobre o capital aportado, não sobre tudo que saiu.

## Regras de cálculo

- `valor_total`, `receita_total` e `custo_total` são colunas geradas pelo Postgres (não aceitam divergência)
- `fluxo_mensal(projeto_id)`: série mensal contínua (meses sem lançamento = 0) com investimento, custo de
  vendas, despesas, saída e acumulados
- Break-even = 1º mês com receita acumulada ≥ saída acumulada
- ROI anualizado = (1 + ROI)^(12/meses) − 1, a partir de 3 meses de série · TIR = taxa mensal que zera o VPL
  do fluxo líquido (bisseção), anualizada por (1 + i)¹² − 1; só existe quando há aportes e receitas
- Cenários: sensibilidade sobre o histórico (receita ±x %, investimento ∓y %), não projeção de futuro

## v3.0 — Organização, investidores e aportes

- **Organização dos sócios** (página Projetos): quem está nela administra todos os projetos vinculados.
- **Investidor**: cadastre o e-mail na linha do participante (aba Parceria) e a pessoa entra em `/carteira`,
  só leitura, vendo a própria participação, os próprios aportes e os totais do projeto.
- **Aportes** (aba Aportes, dono/admin): como cada participante entrou — dinheiro, maquinário, crédito, serviço,
  direito minerário — com comparação % pactuada × % pelos aportes. Aba "Aportes" no Excel.
- Migration `0007_investidores_aportes.sql` (também corrige o erro ao criar projeto presente desde a 0004).

## Configuração

1. **Supabase** → SQL Editor → execute `0001_schema.sql` … `0007_investidores_aportes.sql` (idempotentes, **nesta ordem**).
   Em Authentication → Providers → Email, **mantenha "Confirm email" ligado**: o acesso de sócio é vinculado ao e-mail confirmado da conta e, sem confirmação, qualquer pessoa poderia se cadastrar com o e-mail do sócio e entrar no projeto.
2. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `ANTHROPIC_API_KEY`.
3. `npm install` · `npm run dev` → http://localhost:3000
4. **Vercel**: importe o repositório e cadastre as duas variáveis de ambiente. Build padrão (`next build`).

## Qualidade

```
npm run typecheck   # tsc --noEmit
npm test            # vitest (68 testes)
npm run build       # build de produção
```
Testes do banco (opcional, precisa de psql apontando para um Postgres com `auth.uid()` disponível):
`psql -v ON_ERROR_STOP=1 -f tests/schema.test.sql` — roda em transação e desfaz tudo (idem `schema2`, `schema3` e `schema4`).
