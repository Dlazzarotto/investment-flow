# Investment Dashboard — contexto para o Claude Code

Gestão de aportes (Capex/Opex), vendas/receitas, parceria (tipo + % de participação) e dashboard por projeto (JVs, logística, mineração). Versão atual: 2.2. Idioma de trabalho com o usuário: português.

## Stack

- Next.js 14.2 (App Router, Server Actions, `useFormState`), TypeScript strict, Tailwind
- Supabase (Postgres + Auth + RLS) via `@supabase/ssr`; hospedagem Vercel
- Recharts (gráficos), ExcelJS (exportação), zod (validação), vitest (testes)
- IA: Claude Messages API com `web_search_20250305` (`lib/ia/estimativa.ts`), chave em `ANTHROPIC_API_KEY`

## Estrutura

```
supabase/migrations/   0001_schema.sql (tabelas, colunas geradas, trigger ≤100 %, RLS, fluxo_mensal())
                       0002_estimativas_ia.sql (estimativas de mercado por IA, ultimas_estimativas())
                       0003_participacao_lock.sql (trava de 100 % com lock — sem corrida)
                       0004_projeto_membros.sql (acesso de sócios: papel leitor/editor, RLS por membro)
app/actions/           server actions (zod → Supabase → revalidatePath); erros.ts traduz erros do Postgres
app/projetos/[id]/     dashboard (page.tsx), investimentos/, vendas/, participantes/ (layout.tsx = Shell)
app/api/export/[id]    CSV/XLSX no idioma atual;  app/api/ia/estimar  POST valor médio de mercado
lib/i18n/              config.ts, dicionarios/{pt,en,es,zh}.ts, server.ts (obterD), client.tsx (useI18n)
lib/                   types.ts (enums espelham o SQL), validacao.ts (criarSchemas(d)), calculos.ts (puro),
                       format.ts (formatadores(locale) — Intl, datas em UTC), csv.ts (CSV por idioma),
                       consultas.ts (leituras, com cache() por requisição)
components/            Shell, SeletorProjeto, SeletorIdioma, NavProjeto, Cenarios, forms/, tabelas/ (edição na
                       própria linha), charts/ (estilo.ts = cores e fontes), ui/ (useHoje, useAcaoFormulario)
tests/                 calculos.test.ts, ia.test.ts, i18n.test.ts (vitest); schema*.test.sql (psql)
```

## Comandos

```
npm ci            # instalar exatamente pelo lock
npm run typecheck # tsc --noEmit (deve ficar limpo)
npm test          # vitest — 53 testes, todos devem passar
npm run build     # build de produção (deve ficar sem warnings)
npm run dev       # http://localhost:3000
```

Ambiente: `.env.local` com `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY` (e opcional `ANTHROPIC_MODEL`). Nunca commitar `.env.local`.

## Regras do projeto (inegociáveis)

1. **Mudança completa, nunca parcial.** Ao alterar um conceito, aplicar em TODOS os pontos: SQL (enum/check/trigger), `lib/types.ts`, `lib/validacao.ts`, actions, telas, os 4 dicionários de `lib/i18n/dicionarios/`, exportação e testes.
2. **SQL sempre como arquivo de migration novo e idempotente** em `supabase/migrations/NNNN_nome.sql` — nunca inline em resposta, nunca editar migration já executada. O usuário roda no SQL Editor do Supabase.
3. **i18n obrigatório.** Nenhuma string visível hard-coded: tudo vai para os dicionários, com as mesmas chaves e os mesmos placeholders `{x}` nos 4 idiomas (o teste `i18n.test.ts` falha se divergir). Rótulos de enum ficam em `d.enums`.
4. **Regras de negócio no banco:** `valor_total`/`receita_total` são colunas geradas; participação total ≤ 100 % é trigger; RLS por `public.pode_ver_projeto()` / `pode_editar_projeto()` (dono ou membro de `projeto_membros`). A UI valida antes (zod), pergunta o papel ao banco (`papel_no_projeto`) e traduz o erro depois (`app/actions/erros.ts`).
5. **Cálculos puros** em `lib/calculos.ts` com teste (KPIs, break-even, rateio, ROI anualizado, TIR por bisseção, cenários); agregação mensal contínua é `public.fluxo_mensal()` no Postgres.
6. **Antes de entregar:** `typecheck`, `test` e `build` limpos. Não defender o que existe — auditar e corrigir.
7. **Design:** navy `#2D3278`, laranja `#F47B20`, texto ≥ 18 px, alvos de toque ≥ 48 px, mobile-first (o usuário opera muito pelo celular). Sem bibliotecas de UI novas sem necessidade. A escala do Tailwind já garante o piso: `xs`/`sm`/`base` valem 18 px e a hierarquia vem de peso e cor, não de tamanho; nos gráficos o piso está em `components/charts/estilo.ts` (`FONTE`).

## Decisões já tomadas (não reabrir sem pedido)

- Migração de Streamlit/SQLite (v1) para esta stack: decidida e concluída.
- Participantes são cadastro (nome, papel, %) e continuam separados do acesso. Quem entra no projeto está em `projeto_membros` (convite por e-mail, papel leitor/editor); só o dono convida, remove, altera a estrutura da parceria e exclui o projeto.
- O vínculo do membro é pelo e-mail **confirmado** da conta: com "Confirm email" desligado no Supabase, qualquer um poderia se cadastrar com o e-mail do sócio. Manter a confirmação ligada.
- Estimativa de IA: modelo padrão `claude-sonnet-4-6`, até 5 buscas, resposta JSON validada por zod, gravada em `estimativas_ia`; a tabela de investimentos compara valor lançado × última média por `lower(trim(item))`.
- Fonte via `<link>` (IBM Plex Sans + Noto Sans SC) com `optimizeFonts: false` para o build não depender de rede.

## Ambiente do usuário

Windows + PowerShell 5; projeto dentro do OneDrive. Ao sugerir comandos: um bloco que funcione colado numa linha (separar com `;`), `Expand-Archive -LiteralPath`, `Set-Content` sempre com `-Encoding UTF8` (ou `[IO.File]::WriteAllText` sem BOM para `.env.local`). Dev server e OneDrive conflitam: se aparecer erro estranho de React/`useContext`, apagar `.next`.

## Próximos passos possíveis

