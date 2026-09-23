# Investment Dashboard — contexto para o Claude Code

Gestão de aportes (Capex/Opex), vendas/receitas, parceria (tipo + % de participação) e dashboard por projeto (JVs, logística, mineração). Versão atual: 3.0. Idioma de trabalho com o usuário: português.

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
                       0005_custos_e_despesas.sql (custo direto da venda, tabela despesas, fluxo com saída)
                       0006_papeis_pin_convites.sql (admin/manager/escritório, PIN de autorização, convite por link)
                       0007_investidores_aportes.sql (organização de sócios, papel investidor, e-mail do participante,
                                                      aportes por tipo, resumo_projeto(), minha_carteira(); corrige o
                                                      RLS de INSERT…RETURNING em projetos que quebrava "criar projeto")
                       0008_custeio_estimativas.sql (cadeia logística do projeto, estimativas de preço por cliente,
                                                     itens de custo com driver de rateio; pode_ver_custeio() exclui o investidor)
app/actions/           server actions (zod → Supabase → revalidatePath); erros.ts traduz erros do Postgres
app/projetos/[id]/     dashboard (page.tsx), investimentos/, aportes/, vendas/, despesas/, participantes/,
                       custeio/ (cadeia + lista de estimativas) e custeio/[estimativaId]/ (lançamento por etapa e
                       preço); layout.tsx = Shell; investidor é redirecionado para /carteira/[id]
app/carteira/          visão do investidor: lista (page.tsx) e detalhe por projeto ([id]/page.tsx), só leitura
app/api/export/[id]    CSV/XLSX no idioma atual;  app/api/ia/estimar  POST valor médio de mercado
app/api/ia/custo       POST custo de cargo (pela legislação do país da etapa) ou de serviço, já na base do driver
lib/i18n/              config.ts, dicionarios/{pt,en,es,zh}.ts, server.ts (obterD), client.tsx (useI18n)
lib/                   types.ts (enums espelham o SQL), validacao.ts (criarSchemas(d)), calculos.ts (puro),
                       format.ts (formatadores(locale) — Intl, datas em UTC), csv.ts (CSV por idioma),
                       consultas.ts (leituras, com cache() por requisição), custeio.ts (motor de cálculo reverso),
                       ia/estimativa.ts (chamarClaude compartilhado) e ia/custo.ts (prompt de cargo/serviço)
components/            Shell, SeletorProjeto, SeletorIdioma, NavProjeto, Cenarios, forms/, tabelas/ (edição na
                       própria linha), charts/ (estilo.ts = cores e fontes), ui/ (useHoje, useAcaoFormulario),
                       custeio/ (Cadeia, FormEstimativa, Lancamentos, FormItem, PainelIA, PainelResultado)
tests/                 calculos.test.ts, custeio.test.ts, ia.test.ts, i18n.test.ts, csv.test.ts (vitest);
                       schema*.test.sql (psql)
```

## Comandos

```
npm ci            # instalar exatamente pelo lock
npm run typecheck # tsc --noEmit (deve ficar limpo)
npm test          # vitest — 93 testes, todos devem passar
npm run build     # build de produção (deve ficar sem warnings)
npm run dev       # http://localhost:3000
```

Ambiente: `.env.local` com `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY` (e opcional `ANTHROPIC_MODEL`). Nunca commitar `.env.local`.

## Regras do projeto (inegociáveis)

1. **Mudança completa, nunca parcial.** Ao alterar um conceito, aplicar em TODOS os pontos: SQL (enum/check/trigger), `lib/types.ts`, `lib/validacao.ts`, actions, telas, os 4 dicionários de `lib/i18n/dicionarios/`, exportação e testes.
2. **SQL sempre como arquivo de migration novo e idempotente** em `supabase/migrations/NNNN_nome.sql` — nunca inline em resposta, nunca editar migration já executada. O usuário roda no SQL Editor do Supabase.
3. **i18n obrigatório.** Nenhuma string visível hard-coded: tudo vai para os dicionários, com as mesmas chaves e os mesmos placeholders `{x}` nos 4 idiomas (o teste `i18n.test.ts` falha se divergir). Rótulos de enum ficam em `d.enums`.
4. **Regras de negócio no banco:** `valor_total`/`receita_total` são colunas geradas; participação total ≤ 100 % é trigger; RLS por `public.pode_ver_projeto()` / `pode_editar_projeto()` (dono ou membro de `projeto_membros`). A UI valida antes (zod), pergunta o papel ao banco (`papel_no_projeto`) e traduz o erro depois (`app/actions/erros.ts`).
5. **Cálculos puros** em `lib/calculos.ts` com teste (KPIs, margem por venda, break-even, rateio, ROI anualizado, TIR por bisseção, cenários); agregação mensal contínua é `public.fluxo_mensal()` no Postgres.
6. **Três saídas, não uma.** `investimentos` = capital aportado; `vendas.custo_total` = custo direto daquele embarque (coluna gerada: mercadoria + frete + impostos % + comissão %); `despesas` = custeio do projeto. `saida = investimento + custo_vendas + despesas`, e saldo/break-even/TIR/cenários olham para a saída. ROI continua sendo `saldo ÷ investimento` — retorno sobre o capital, não sobre tudo que saiu.
7. **Antes de entregar:** `typecheck`, `test` e `build` limpos. Não defender o que existe — auditar e corrigir.
8. **Design:** navy `#2D3278`, laranja `#F47B20`, texto ≥ 18 px, alvos de toque ≥ 48 px, mobile-first (o usuário opera muito pelo celular). Sem bibliotecas de UI novas sem necessidade. A escala do Tailwind já garante o piso: `xs`/`sm`/`base` valem 18 px e a hierarquia vem de peso e cor, não de tamanho; nos gráficos o piso está em `components/charts/estilo.ts` (`FONTE`).

## Decisões já tomadas (não reabrir sem pedido)

- **Organização (0007):** `organizacoes` + `organizacao_membros` (por e-mail confirmado). Sócio da organização = `admin`
  em todo projeto com `organizacao_id` dela; projeto novo nasce na organização de quem cria (trigger). Ordem de
  `papel_no_projeto`: dono → sócio da organização → `projeto_membros` → participante com e-mail (`investidor`).
- **Investidor (0007):** basta cadastrar o e-mail na linha de `participantes` — a pessoa entra como `investidor`,
  só leitura, e vê só a própria linha e os próprios aportes (RLS), mais vendas/despesas e os totais via
  `resumo_projeto()` (security definer). Não vê investimentos nem membros. Vive em `/carteira`.
- **Aportes (0007):** `aportes` (dinheiro, maquinário, crédito, serviço, direito minerário, outro) por participante,
  com valor avaliado; trigger garante participante do mesmo projeto; só dono/admin lançam. A tela compara
  % pactuada × % implícita pelos aportes (`resumoAportes`).
- **Roadmap acordado com o usuário:** v3.1 catálogo de commodities (parâmetros de qualidade, ajuste vs benchmark)
  + benchmarks Shanghai/Londres/EUA via IA+web; v3.2 motor de custo reverso (mão de obra por função, noturno +50 %,
  produção, logística por trecho com tempo, porto/documentação, margem/incoterm → preço/t) com template gerado
  pela IA; v3.3 consolidação por projeto e investidor.

- Migração de Streamlit/SQLite (v1) para esta stack: decidida e concluída.
- Participantes são cadastro (nome, papel, %) e continuam separados do acesso. Quem entra no projeto está em `projeto_membros`, com um de três papéis:
  - **admin** — tudo que o dono faz, menos excluir o projeto
  - **manager** — vê e lança entradas e saídas; **não enxerga investimentos** (a aba some e o RLS filtra, então o fluxo mensal dele vem sem capex e sem ROI)
  - **escritorio** — só lança; alterar e excluir exigem o **PIN do projeto**
- O PIN é do projeto, cadastrado pelo admin, guardado com bcrypt e nunca lido de volta. **Não é a senha de login de ninguém** — pedir a senha da conta de outra pessoa é o caminho curto para vazá-la. Acertar abre uma janela de poucos minutos (`public.autorizacoes`), e o RLS é quem exige a janela.
- Convite por e-mail e por **link** (`/convite/[token]`): o banco guarda só o sha256 do token, com validade, número de usos e revogação. Entrar é um clique, não a visita — prefetch e prévia de link não gastam um uso.
- Quem decide é sempre o banco (`papel_no_projeto`, `pode_*`); `lib/permissoes.ts` espelha isso só para a tela não oferecer botão que o RLS vai recusar.
- O vínculo do membro é pelo e-mail **confirmado** da conta: com "Confirm email" desligado no Supabase, qualquer um poderia se cadastrar com o e-mail do sócio. Manter a confirmação ligada.
- Estimativa de IA: modelo padrão `claude-sonnet-4-6`, até 5 buscas, resposta JSON validada por zod, gravada em `estimativas_ia`; a tabela de investimentos compara valor lançado × última média por `lower(trim(item))`.
- Fonte via `<link>` (IBM Plex Sans + Noto Sans SC) com `optimizeFonts: false` para o build não depender de rede.

### Custeio — cálculo reverso (0008, etapa 1 fechada)

- **A cadeia é do projeto, a estimativa é do cliente.** `projeto_etapas` guarda o percurso uma vez (mina → estrada →
  porto → barcaça → navio); `estimativas_custo` são várias por projeto, uma por cliente/lote, cada uma com seu volume,
  sua moeda e sua margem. Nada é fixado em país nem em commodity: `pais`, `commodity` e `unidade` são texto livre e o
  único enum é `modal`, que existe para orientar a sugestão da IA.
- **O preço não é uma pilha.** `P = C / (1 − r − m)`. Empilhar custo × imposto × margem dá o número errado (52,80 onde
  o certo é 57,14 com custo 40, imposto 10 % e margem 20 %); `tests/custeio.test.ts` verifica a identidade
  `receita − imposto − custo = margem`, não só o número.
- **Driver é o coração do lançamento:** cada item diz como vira custo por unidade (`por_unidade`, `por_dia`, `por_mes`,
  `por_viagem`, `por_lote`, `pct_custo`, `pct_receita`). Item sem o dado necessário (por dia sem produção diária, por
  viagem sem capacidade) **não vira zero em silêncio**: sai da soma, aparece em "custos fora da conta" e o banco recusa
  por check.
- **A IA sugere na base do driver escolhido**, não um preço solto — o número cai direto no campo. Para cargo, pergunta
  o custo do empregador pela legislação do país da etapa e deixa o adicional noturno de fora (o sistema aplica depois).
  Nada é gravado pela rota: o valor usado marca o item com `origem: 'ia'` e a fonte, até alguém confirmar na tela.
- `BotaoExcluir` é um `<form>`: nunca colocá-lo dentro de outro formulário.

## Ambiente do usuário

Windows + PowerShell 5; projeto dentro do OneDrive. Ao sugerir comandos: um bloco que funcione colado numa linha (separar com `;`), `Expand-Archive -LiteralPath`, `Set-Content` sempre com `-Encoding UTF8` (ou `[IO.File]::WriteAllText` sem BOM para `.env.local`). Dev server e OneDrive conflitam: se aparecer erro estranho de React/`useContext`, apagar `.next`.

## Próximos passos possíveis

- Convite com link/e-mail automático (hoje o dono avisa o sócio por fora)
- Histórico de alterações (quem editou o quê)
- Projeção de fluxo futuro (lançamentos planejados), além dos cenários sobre o histórico
