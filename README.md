# Gestão de Aportes — Next.js + Supabase + Vercel (v2.2)

Investimentos (Capex/Opex), vendas/receitas, parceria (tipo + participação %) e dashboard
por projeto. Reescrita da v1 (Streamlit/SQLite) na stack Next.js 14 · TypeScript · Supabase · Vercel.

## Estrutura

```
supabase/migrations/0001_schema.sql   # enums, tabelas, colunas geradas, trigger ≤100 %, RLS, fluxo_mensal()
supabase/migrations/0002_estimativas_ia.sql  # estimativas de valor médio (IA), RLS, ultimas_estimativas()
app/
  login/                              # e-mail + senha (Supabase Auth)
  projetos/page.tsx                   # lista + criar projeto (nome, moeda, tipo de parceria, sua %)
  projetos/[id]/layout.tsx            # shell com seletor global de projeto e abas
  projetos/[id]/page.tsx              # dashboard: saldo, KPIs, 3 gráficos, rateio por participação, tabela mensal
  projetos/[id]/investimentos/        # formulário + tabela com exclusão
  projetos/[id]/vendas/               # formulário + tabela com exclusão
  projetos/[id]/participantes/        # estrutura da parceria, participantes, exclusão do projeto
  api/export/[id]/route.ts            # ?formato=csv | xlsx (6 abas, inclui Estimativas IA)
  api/ia/estimar/route.ts             # POST — valor médio de mercado do item via Claude API + busca na web
  actions/                            # server actions (zod → Supabase → revalidate)
lib/                                  # types, validacao (zod, mensagens traduzidas), calculos, format (por idioma), consultas, supabase/
lib/i18n/                             # config (pt/en/es/zh), dicionarios/*.ts, server.ts (cookie/Accept-Language), client.tsx (provider)
components/                           # Shell, seletor, nav, forms, charts (Recharts), ui
tests/calculos.test.ts                # 12 testes (vitest): KPIs, break-even, rateio, zod, formatação
tests/ia.test.ts                      # 10 testes: parser/validação da resposta da IA, prompt, desvio vs média
tests/i18n.test.ts                    # 9 testes: paridade de chaves/placeholders nos 4 idiomas, Intl por locale, mensagens traduzidas
tests/schema.test.sql                 # testes do banco (psql): colunas geradas, fluxo mensal, trava 100 %, RLS, cascata
tests/schema2.test.sql                # testes da migration 0002
```

## Idiomas (pt · en · es · zh)

- Detecção automática pelo `Accept-Language` na primeira visita (cookie `idioma`); seletor no cabeçalho e na tela de login.
- Um único dicionário por idioma em `lib/i18n/dicionarios/`; `pt.ts` define o tipo e os demais são checados pelo TypeScript e por teste (mesmas chaves e mesmos placeholders).
- Tudo é traduzido: telas, formulários, validações zod, erros do banco, enums, gráficos, exportação (abas e cabeçalhos), `<html lang>` e o idioma das premissas/observações geradas pela IA. Moeda, número, data e mês seguem o `Intl` do idioma.

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
- A estimativa fica em `estimativas_ia`; a tabela de investimentos mostra a última média por item e o desvio
  do valor lançado (vermelho > +15 %, verde < −15 %). O Excel ganha a aba "Estimativas IA".
- Requisitos: `ANTHROPIC_API_KEY` no servidor (Vercel → Environment Variables) e busca na web habilitada
  para a organização no Console da Anthropic. Sem a chave, o recurso fica oculto e o resto do sistema funciona.

## Regras de cálculo

- `valor_total` e `receita_total` são colunas geradas pelo Postgres (não aceitam divergência)
- `fluxo_mensal(projeto_id)`: série mensal contínua (meses sem lançamento = 0) com acumulados
- Saldo = receita − investimento · ROI = saldo ÷ investimento · Break-even = 1º mês com receita acum. ≥ custo acum.

## Configuração

1. **Supabase** → SQL Editor → execute `supabase/migrations/0001_schema.sql` e depois `0002_estimativas_ia.sql` (idempotentes).
   Em Authentication → Providers → Email, desative "Confirm email" se quiser entrar sem confirmação.
2. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `ANTHROPIC_API_KEY`.
3. `npm install` · `npm run dev` → http://localhost:3000
4. **Vercel**: importe o repositório e cadastre as duas variáveis de ambiente. Build padrão (`next build`).

## Qualidade

```
npm run typecheck   # tsc --noEmit
npm test            # vitest (31 testes)
npm run build       # build de produção
```
Testes do banco (opcional, precisa de psql apontando para um Postgres com `auth.uid()` disponível):
`psql -v ON_ERROR_STOP=1 -f tests/schema.test.sql` — roda em transação e desfaz tudo.
