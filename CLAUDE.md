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
                       0009_plataforma_empresa_historico.sql (conta master, empresa com plano/assentos/logo,
                                                     trava de contrato, trilha de auditoria) — etapa 1 da v4
                       0010_master_empresas.sql (master cria empresa e senta o ADM: criar_empresa(),
                                                     empresas_da_plataforma())
                       0011_faturamento_plataforma.sql (mensalidade/setup/vencimento na empresa, tabela faturas,
                                                     painel_plataforma() por moeda, gerar_mensalidades())
                       0012 + 0013_travas_parte2.sql (suspensão bloqueia de verdade; investidor perde despesas e
                                                     cadeia logística. A 0012 truncou no editor — a 0013 é o resto)
                       0014_clientes_fornecedores.sql (cadastros comerciais da empresa — etapa 2 da v4)
                       0015_commodities.sql (catálogo + parâmetros de qualidade com ajuste_por_ponto — etapa 3)
                       0016_painel_empresa.sql (painel_empresa(): consolidado da empresa, uma linha por moeda)
                       0017_painel_empresa_corrige.sql (a 0016 falhava em TODA chamada — "moeda" ambígua; USD só
                                                     entra sem projeto; receita do mês sem venda futura)
                       0018_contratos.sql (contrato comercial: compra/venda, trader/agente, preço fixo/fórmula,
                                                     LC/TT; mesma empresa por FK composta; escrever exige empresa em dia)
                       0019_partes_instrumentos_monetizacao.sql (partes do contrato, conta/assinante, instrumentos DLC/SBLC/LC,
                                                     monetização, remuneração da gestão; projeto só entra em empresa de quem grava)
                       0020_pagamento_negociado.sql (pagamento = % antecipado + saldo no carregamento/BL/documentos/
                                                     descarga + prazo; forma_pagamento LC/TT aposentada)
                       0021_documentos_clientes.sql (CIS/LOI/ICPO/KYC… do cliente: tabela + bucket PRIVADO "documentos";
                                                     políticas do Storage pela 1ª pasta do caminho = empresa)
                       0022_projetos_sob_gestao.sql (status do projeto; projeto novo nasce 0 % da empresa; vendas da 1ª versão
                                                     viram contratos concluídos com venda_origem_id; resumo_projeto sem dupla contagem)
                       0023_master_plataforma.sql + 0024_master_sai_da_dsd.sql (master da plataforma em conta própria;
                                                     o gmail fica só ADM da DSD — a 0024 só age com a conta nova confirmada)
                       0025_cadastro_so_por_convite.sql (conta avulsa não cria empresa — criar_organizacao revogada — nem projeto
                                                     fora de empresa; admin do projeto volta a editar o projeto, só não o muda de empresa)
                       0026_excluir_projeto.sql (excluir_projeto(): projeto + contratos/garantias/monetizações dele numa instrução;
                                                     o delete direto esbarrava em contratos_conta_ck desde a 0022)
                       0027_uma_empresa_por_email.sql (índice único global em organizacao_membros.email_normalizado: quem
                                                     administra uma empresa nunca entra em outra — nem pelo master, nem como sócio)
                       0028_excluir_empresa.sql (excluir_empresa(): master exclui empresa VAZIA; a trava do último ADM impedia
                                                     excluir qualquer empresa; check NOT VALID: e-mail do master não administra empresa)
                       0029_catalogo_locais_termos.sql (Grupo → Commodity → Grade → Especificação; grupos padrão + da empresa;
                                                     cadastro de Locais com calado; contrato com grade, packing, base de preço, rota, navio,
                                                     barcaça, transbordo, frete, demurrage, inspeção e documentos exigidos)
                       0030_catalogo_commodities_mercado.sql (67 commodities do mercado nos 12 grupos, só leitura; a empresa ADOTA
                                                     com um toque (commodities.padrao_codigo); as antigas encaixadas pelo nome. GERADA junto com
                                                     os dicionários e COMMODITIES_PADRAO — editar a fonte, não o SQL à mão)
                       0031_pesquisa_mercado.sql (pesquisas_mercado da empresa: modo livre/bolsas, cotação lida do JSON do
                                                     agente; painel_commodities: até 3 commodities por USUÁRIO para o painel)
                       0032_auditoria_travas.sql (auditoria: suspensão trava cadastros/ADM/capex/projeto; gerente sem capital;
                                                     resultado do projeto por moeda + compra concluída; contrato convertido travado;
                                                     histórico com empresa; excluir_empresa conta locais/grupos; escritório no custeio)
app/actions/           server actions (zod → Supabase → revalidatePath); erros.ts traduz erros do Postgres
app/projetos/          aba própria: cartões com status (em análise/em andamento/encerrado) e resultado, filtro por status
app/projetos/[id]/     page.tsx = Resumo (resultado via resumo_projeto, sócios, como a empresa ganha, contratos do projeto);
                       participantes/ = Sócios e investidores (+ remuneração da gestão, acesso, PIN); aportes/; despesas/ =
                       Custos do projeto (despesas + capex); vendas/ e investimentos/ só redirecionam; custeio/ segue ali
                       até a proposta sair do projeto. layout.tsx = Shell; investidor vai para /carteira/[id]
app/carteira/          visão do investidor: lista (page.tsx) e detalhe por projeto ([id]/page.tsx), só leitura
app/painel/            dashboard do ADM: a EMPRESA inteira. É a página de entrada (/, pós-login e caminhoInterno);
                       quem não tem empresa (investidor, membro de projeto, conta nova) segue para /projetos
app/vendas, /compras   lista de contratos com a direção fixa (components/contratos/PaginaContratos); /contratos redireciona
app/contratos/         novo/ (?estimativa= preenche pela proposta; ?direcao=) e [id]/ (resumo + garantias + edição); contas
                       puras em lib/contratos.ts (preço, valor, faixa, comissão, resumoContratos)
app/propostas/         todas as propostas (custeio) da empresa; ainda nascem dentro de um projeto (cadeia é do projeto, 0008)
app/clientes, /fornecedores, /commodities, /locais  cadastros comerciais da EMPRESA (não do projeto); fornecedor usa o vocabulário do
                       custeio (grupo_custo, modal_etapa) para o lançamento herdar sem tradução no meio
app/master/            painel da plataforma: panorama (ativos, inativos, em débito, contrato, a receber — widget
                       clicável filtra a lista), liberar empresa, contrato, faturas e administradores
app/login, /criar-conta, /esqueci-senha, /redefinir-senha, /auth/confirmar, /convite/[token]
                       telas de fora da aplicação; todas usam components/MolduraEntrada
app/api/export/[id]    CSV/XLSX/PDF no idioma atual (PDF = lib/relatorio.ts, HTML com CSS de impressão: um
                       gerador de PDF precisaria embutir fonte CJK de megabytes para o chinês não sair em
                       quadradinhos, e o navegador já tem as fontes de todos os idiomas);  app/api/ia/estimar  POST valor médio de mercado
app/api/ia/custo       POST custo de cargo (pela legislação do país da etapa) ou de serviço, já na base do driver
lib/i18n/              config.ts, dicionarios/{pt,en,es,zh}.ts, server.ts (obterD), client.tsx (useI18n)
lib/                   types.ts (enums espelham o SQL), validacao.ts (criarSchemas(d)), calculos.ts (puro),
                       format.ts (formatadores(locale) — Intl, datas em UTC), csv.ts (CSV por idioma),
                       consultas.ts (leituras, com cache() por requisição), custeio.ts (motor de cálculo reverso),
                       ia/estimativa.ts (chamarClaude compartilhado) e ia/custo.ts (prompt de cargo/serviço)
components/            Shell, SeletorProjeto, SeletorIdioma, NavProjeto, Cenarios, forms/, tabelas/ (edição na
                       própria linha), charts/ (estilo.ts = cores e fontes), ui/ (useHoje, useAcaoFormulario),
                       custeio/ (Cadeia, FormEstimativa, Lancamentos, FormItem, PainelIA, PainelResultado)
tests/                 calculos.test.ts, custeio.test.ts, pesquisa.test.ts, texto.test.ts, catalogo.test.ts, contratos.test.ts, documentos.test.ts, ia.test.ts, i18n.test.ts, csv.test.ts (vitest);
                       schema*.test.sql (psql; schema13 e schema15–22 rodam da raiz). schema, schema4, schema5 e o trecho de PIN do schema6 estão
                       DESATUALIZADOS desde 0005/0006 (inv_acumulado, papel leitor, autorizacoes) — reescrever, não confiar
```

## Comandos

```
npm ci            # instalar exatamente pelo lock
npm run typecheck # tsc --noEmit (deve ficar limpo)
npm test          # vitest — 159 testes, todos devem passar
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

### Reorganização v4 — plataforma multiempresa (em andamento)

Mapa completo e ordem de construção: https://claude.ai/code/artifact/162870f8-45ec-4425-92b4-dfb1113cd567

O sistema deixa de ser um painel de projetos e vira plataforma vendida por assinatura a empresas de trade.
Decisões fechadas com o usuário (não reabrir sem pedido):

- **A Investment Flow é a plataforma; a DSD é uma empresa CLIENTE dela, como qualquer outra.** Master e ADM de
  empresa são contas diferentes: master = `david@peaceontax.com` (0023); `david.lazzarotto@gmail.com` é só ADM da
  DSD (a 0024 o tira do master, e só depois de a conta nova existir com e-mail confirmado). Master sem empresa entra
  em `/master`.
- **Conta só nasce por convite, e conta sem convite é vazia (0025).** A tela de login não tem "criar conta";
  `/criar-conta` existe porque o convidado e o ADM liberado pelo master entram por ela. A trava não é a tela (a chave
  pública do Supabase está no navegador): é o banco. `criar_organizacao()` está revogada — empresa só nasce por
  `criar_empresa()` do master — e projeto só nasce dentro da empresa de quem grava.
- **Empresas nunca se misturam (0027, exigência do usuário).** Um e-mail pertence a UMA empresa: o índice único é
  global, não por empresa. O master não libera empresa com e-mail de ADM de outra, e o ADM não traz como sócio quem
  já é de outra. Acesso a um PROJETO de outra empresa (projeto_membros/investidor) é outra coisa e continua possível.
  Empresa nova nasce zerada; o master copia o link de /criar-conta na própria tela depois de liberar.
- **No master, por empresa (0028):** editar nome (no Contrato), trocar o e-mail do ADM (entra o novo, sai o antigo —
  funciona com o único), remover ADM só quando há mais de um, "Reenviar convite" (link + copiar + mailto: abre o
  e-mail de quem usa, sem depender do SMTP do Supabase) e excluir empresa VAZIA. Empresa com dados se suspende.
  Ação de formulário do master devolve mensagem, nunca lança: lançar derruba a página em "Algo deu errado".
- **Confirmar exclusão digitando o nome** usa `mesmoNome()` (lib/texto.ts): ignora maiúsculas, acentos e espaços.
- **Equipe da empresa mora em "Conta e empresa" (/conta), não em Projetos.** Quem está em `organizacao_membros` é
  ADMINISTRADOR da empresa (vê tudo, ocupa assento) — não "sócio" (vocabulário da 1ª versão). A tela mostra
  assentos em uso (`assentos_ocupados`) e traduz a trava do plano. "Vincular/desvincular projeto da organização"
  saiu: desde 0022/0025 projeto é sempre da empresa, e desvincular o tirava do painel (ou quebrava com contrato).
- **Master libera empresas e NÃO lê os dados delas.** Nenhuma policy de projeto,
  custo, cliente ou documento menciona `eh_master()` — é isso que torna o sistema vendável a tradings
  concorrentes entre si. Ele vê `organizacoes` e `organizacao_membros`, e mais nada.
- **Plano e assentos moram no banco, não no contrato.** `organizacoes.plano/assentos/ativa/vigencia_ate` só o
  master altera (trigger `contrato_so_master`), porque a policy `organizacoes_alterar` de 0007 deixa o ADM dar
  update na própria linha — sem a trava, o cliente se promovia sozinho para a faixa de cima.
- **Investidor não ocupa assento** (`assentos_ocupados()`): cobra-se a equipe, não a carteira de clientes.
  Se a regra comercial mudar, é essa função que muda, e só ela.
- **Gerente tem permissão por módulo**, marcada pelo ADM no convite — não é mais papel fixo.
- **O investidor vê números, nunca nomes.** O lançamento aponta para um cadastro de fornecedor (serviço, tipo,
  valor) em vez de ter descrição livre: o nome fica do outro lado da chave, onde o RLS não deixa ele chegar.
  Consequência de ordem: **fornecedores precisam existir antes de a visão do investidor ser liberada.**
- **Histórico desde já** (`historico` + `tg_historico`): o que não foi gravado no dia não volta.
- **O ADM trabalha no nível da EMPRESA.** A página de entrada é `/painel` (consolidado: clientes, fornecedores,
  commodities, projetos, receita, saída, saldo). O projeto é um CAMPO do lançamento, não um lugar onde ele
  precisa entrar — a visão por projeto é do investidor.
- **A cadeia comercial, como o usuário a descreveu:** LOI + CIS abrem o **cliente** → o cliente vira
  **estimativa** → a estimativa gera a **SCO** → a SCO diz se o contrato é de **1 ano ou 1 carga**. Contrato de
  1 ano tem vários **embarques**, e é dos embarques que saem "a embarcar" e "a receber". Nada disso existe
  ainda: por isso o painel avisa na tela em vez de mostrar zero.
- **Valor em moeda não quebra linha.** O espaço que o `Intl` põe em "US$ 2.980.000,00" é não-quebrável, então
  o texto transborda em vez de quebrar. Cartão de KPI com dinheiro usa `text-lg`, ocupa a largura inteira no
  celular e só vira 4 colunas em `xl`. Conferir com `scrollWidth > clientWidth` de 360 a 1920 px.
- **Dinheiro é somado por moeda.** `painel_plataforma()` devolve UMA LINHA POR MOEDA; somar BRL com USD num
  widget só dá um número que não existe. Com uma moeda só, a tela lê a primeira linha e fica igual a um painel
  simples. BRL sempre entra na lista, senão o painel sem empresas devolveria zero linhas e a tela ficaria branca.
- **Migrations com função usam delimitador nomeado** (`$fn$`, `$ck$`), nunca `$$`: o editor de SQL do Supabase
  quebra a instrução no primeiro `;` de dentro do corpo e devolve "unterminated dollar-quoted string".

### Espinha da operação — trading de commodities (em andamento)

Decidido com o usuário: o centro é o NEGÓCIO, não o projeto. Cadeia: proposta (estimativa de custo) → LOI/ICPO →
SCO → **contrato** (0018) → **embarques** (etapa 2) → **faturas, LC e recebimentos** (etapa 3) → **custos por
embarque ligados a fornecedor** e margem real × proposta (etapa 4) → painel reescrito (etapa 5).

- **A empresa é trader E agente**: `direcao` (venda/compra) e `papel` (principal/agente) por contrato. Trader casa
  compra e venda no embarque (back-to-back); agente tem um contrato só e a receita é a comissão.
- **Preço fixo ou fórmula** (índice ± prêmio no período de cotação). `indice_referencia` serve só para PROJETAR;
  sem ele o valor é desconhecido (null, "a confirmar"), nunca zero. Ajuste de qualidade entra no embarque, pelo laudo.
- **Carta de crédito (DLC/SBLC/LC) é GARANTIA, não forma de pagamento** (correção do usuário; a 0018 errou). Mora em
  `instrumentos` ("Garantias bancárias"). Pagamento é o cronograma negociado (0020): `pct_antecipado` + saldo no
  `evento_saldo` (carregamento, BL, documentos, descarga) + `prazo_pagamento_dias`. Venda FOB DENTRO DO PAÍS paga no
  carregamento do caminhão — não há BL. Provisória continua opcional. `forma_pagamento` é coluna obsoleta.
- **Partes vêm de `clientes`** (`contrato_partes`: comprador, vendedor, Financial Partner — um de cada por contrato;
  `contratos.contraparte_id` está obsoleto desde a 0019). Trader vendendo: só o comprador é cliente (a empresa é o
  vendedor); comprando: só o vendedor; intermediando (agente): os dois. Fornecedor é prestador e entra nos custos do
  embarque. Para a DSD "todos são clientes" (decisão do usuário): Financial Partner é um TIPO de cliente.
- **Financial Partner recebe e administra o instrumento bancário** (DLC/SBLC/LC) e consta no contrato de compra e
  venda para isso; não responde pelo produto — por isso não aparece nos seletores de comprador/vendedor.
- **Monetização é outro contrato** (FP ↔ vendedor), ligado ao instrumento: o FP paga **% do valor de FACE** (ex.:
  35 %), o valor vai para o vendedor ou para o projeto, e a empresa ganha **% do valor MONETIZADO** (ex.: 5 %) —
  nunca do face. `comissaoMonetizacao()` tem teste que prova a diferença.
- **Por conta de × quem assina:** `conta` (propria/projeto) decide para onde vai o resultado; `assinante`
  (empresa/projeto) é só jurídico. Contrato por conta de projeto vai para "Sob gestão" e NÃO soma na empresa.
- **Remuneração da gestão** por projeto (`remuneracoes_gestao`): taxa adm % a.a. sobre aportes, fixo mensal, % sobre
  vendas, por unidade, performance (% do lucro — "a confirmar" até haver resultado). "Por ano" e "sobre contratos"
  são horizontes diferentes e o painel mostra separados. O investidor não vê esta tabela.
- **Projeto = o que a empresa ADMINISTRA para investidores (0022, decisão do usuário).** Menu principal é da empresa:
  Painel, Vendas, Compras, Propostas, Projetos, Clientes, Fornecedores, Commodities. Dentro do projeto só: Resumo,
  Sócios e investidores, Aportes, Custos do projeto. Sem seletor de projeto na lateral; sem "tipo de parceria / sua
  participação" (a empresa nasce 0 % — se também for sócia, informa a %). Painel geral tem o bloco "Projetos" com
  Em andamento / Encerrado / Em análise, e abaixo só os resultados sob gestão (não somam na empresa). O bloco
  "Resultado consolidado" (investimentos + vendas + despesas de TODOS os projetos, da 1ª versão) saiu do painel:
  somava na empresa um saldo que não é dela. `painel_empresa()` ainda calcula essas somas; o painel só usa as contagens.
- **Excluir projeto é pela função `excluir_projeto()` (0026), nunca delete direto.** Fica no Resumo do projeto, junto
  do status; só o dono. Leva os contratos por conta do projeto (e garantias/monetizações deles); contrato da própria
  empresa que só citava o projeto continua, sem ele.
- **Vendas da 1ª versão viraram contratos concluídos** (`contratos.venda_origem_id`). A linha antiga NÃO foi apagada:
  `resumo_projeto()` soma a venda antiga OU o contrato, nunca os dois — o investidor vê os mesmos números de antes.
  Contrato novo só entra no resultado do projeto quando CONCLUÍDO (preço fixo); fórmula entra com os embarques.
- **Documentos do cliente (0021):** o navegador sobe o arquivo direto ao bucket privado `documentos` no caminho
  `<organizacao_id>/clientes/<cliente_id>/<uuid>-<nome>`; as políticas de `storage.objects` conferem a empresa pela
  1ª pasta (com `case` + regex antes do `::uuid`, para nome estranho negar em vez de quebrar). Só depois grava o
  registro; se o registro falha, o arquivo é removido. Abrir = link assinado de 60 s. Selo "Sem CIS" na ficha: o
  CIS (com a LOI) abre o cliente. Testar localmente exige stub do Storage (buckets, objects com RLS, foldername()).
- **Preço de minério de ferro (material do usuário, para a etapa de embarques):**
  `Preço final (USD/DMT) = Referência + Σ (teor − base) × VIU por ponto + Lump Premium + Diferencial Comercial`.
  Base mais limpa para 64–66 % Fe é a referência 65 % Fe (Fastmarkets MB-IRO-0009; VIUs Fe 0019, SiO₂ 0020,
  Al₂O₃ 0021, P 0024). O "preço-alvo" (ex.: US$ 119) entra como DIFERENCIAL COMERCIAL sobre o índice, não como preço
  fixo. Quantidade faturável em DMT = WMT × (1 − umidade). Nunca escalar proporcionalmente (preço 62 % × 64/62).
  ARMADILHAS a tratar no cálculo: (1) VIU de SiO₂/Al₂O₃/P é por ponto × diferença da base, não valor fixo (a planilha
  do usuário os trata como fixos); P costuma ser por 0,01 %; (2) Lump Premium da Platts é em US$/dmtu — multiplica
  pelo teor de Fe (25,50 ¢/dmtu × 62 = US$ 15,81/dmt), não é US$/dmt direto; (3) não misturar base 65 % Fastmarkets
  com prêmio de lump normalizado a 62 % Platts sem conversão; (4) teor mínimo/rejeição vêm de min/max dos
  parâmetros da commodity (0015 já tem referência, mínimo, máximo e ajuste_por_ponto).
- **Projeto criado antes da empresa fica com `organizacao_id` vazio** e some do contrato e do painel (a FK composta
  exige a mesma empresa). O aviso `ProjetosForaDaEmpresa` (painel e contratos) traz com um clique — só os projetos
  de que o usuário é DONO; projeto compartilhado não muda de empresa por decisão de quem só participa.
- Painel: "Operação" vem primeiro — contratos ativos, em negociação, contratado por moeda e posição por
  commodity (comprado − vendido; toneladas não se somam com barris).

### Auditoria de integração (0032, decisões do usuário)

- **Ação curta devolve mensagem, nunca lança.** Excluir, mudar status, revogar: `(s, fd) => Promise<ActionState>` com
  `FormAcao`/`BotaoExcluir`. Server action que lança derruba a página em "Algo deu errado" e, em produção, o Next troca
  a mensagem traduzida por texto genérico. Delete recusado pelo RLS volta 0 linhas SEM erro: conferir com `.select("id")`.
- **Resultado do projeto (resumo_projeto):** só contratos na MOEDA do projeto (os de outra moeda aparecem marcados no
  Resumo, fora da soma); venda concluída = receita, compra concluída = saída, ambas por conta do projeto e como principal.
  Intermediação (agente) é receita da EMPRESA em qualquer conta e não entra em "sob gestão".
- **Gerente e escritório não veem capital:** `resumo_projeto` zera investimento e aportes para eles; `aportes_ver` só
  dono/admin (e o investidor, a própria linha).
- **Contrato convertido da 1ª versão** tem os números travados (trigger); excluir leva a venda antiga junto.
- **Suspensão:** restritivas `*_em_dia_*` na escrita; o master continua gerindo ADMs de empresa suspensa. O aviso mora no
  Shell (todas as telas) e `meu_acesso_suspenso()` inclui o ADM sem projeto e o investidor.
- **Menu por papel:** sem empresa, a lateral não mostra Painel/Vendas/Compras/Propostas/cadastros.
- **Painel ↔ listas:** cartão e lista usam o mesmo recorte (`porDirecao`, filtro `?status=ativos`).

### Pesquisa de mercado e preços no painel (0031, decisões do usuário)

- **O preço vem de um Managed Agent** ("Pesquisador de Commodities", web search/fetch), não de API de cotação: `lib/ia/pesquisador.ts`
  abre a sessão com teto de custo (`PESQUISA_ORCAMENTO_USD`, padrão 2) e a tela consulta `GET /api/pesquisa-mercado/[id]` a cada 6 s —
  nada de função longa na Vercel. Variáveis: `PESQUISA_AGENT_ID`, `PESQUISA_ENVIRONMENT_ID` e `ANTHROPIC_API_KEY` do MESMO workspace do agente.
- **A resposta é texto; o número é o bloco JSON do fim** (`extrairCotacao`, `extrairCotacoesBolsas`). Campo ilegível vira null, nunca zero.
- **Aba Commodities → Pesquisa de mercado** (modo `livre`): commodity, grade, base, "detalhado"; a especificação do grade vai na pergunta.
- **Painel = 3 commodities × Xangai, Londres, Chicago** (modo `bolsas`): último ajuste do contrato mais líquido, com a bolsa e o contrato
  que o agente usou (minério na China é DCE; açúcar em NY é ICE US). Praça sem contrato = "não negociado", nunca número emprestado.
  Variação só contra a pesquisa anterior da MESMA bolsa, moeda, unidade e vencimento (rolagem não é variação de preço).
- A escolha das 3 é de cada usuário (`painel_commodities`); as pesquisas são da empresa e só o ADM as vê (o master não).

### Catálogo, locais e termos do contrato (0029, decisões do usuário)

- **Grupo → Commodity → Grade → Especificação.** A especificação é POR GRADE (Iron Ore Fines 62 % ≠ Lump 65 %);
  parâmetro sem `grade_id` é o padrão da commodity, que o grade HERDA (`especificacaoDoGrade`, lib/catalogo.ts).
- **Grupos: lista pronta + da empresa.** Os 12 padrão têm `organizacao_id` vazio e `codigo` (rótulo em
  `d.enums.grupoCommodity`); os da empresa têm `nome`. Commodity só entra em grupo padrão ou da própria empresa
  (política RESTRITIVA `commodities_grupo_valido`). `commodities.categoria` (texto livre) ficou só para leitura.
- **Grupo sem commodity dentro foi erro (0029 → 0030).** O usuário quer escolher o grupo e VER as commodities dele.
  `commodities_padrao` traz 67 do mercado, cada uma no seu grupo, com unidade e referência de preço; o nome vem de
  `d.enums.commodityPadrao` (4 idiomas). Na tela de Commodities o grupo mostra o "Catálogo do mercado" (um toque
  adiciona) e as da empresa; no contrato, o seletor lista "Da empresa" + "Catálogo do mercado", e escolher uma do
  catálogo a adota na hora (`adotarCommodity`). O número do grupo é o que há para ESCOLHER (empresa + mercado não
  adotado), nunca só as da empresa — "(0)" em grupo cheio parece vazio. No celular, grupos em `<select>`.
- **Locais** (mina, porto, terminal fluvial, armazém, ferrovia, cidade) com país, UN/LOCODE e calado máximo. O
  contrato escolhe origem, ponto de carga, transbordo, ponto de descarga e destino final dessa lista (FK composta:
  mesma empresa). `porto_embarque`/`porto_destino` (texto) ficaram como legado, preservados e exibidos.
- **Contrato em seções:** Partes · Produto (cascata grupo → commodity → grade, "+ nova commodity/grade" ali mesmo)
  · Preço (base de preço, Incoterm) · Pagamento · Rota e logística · Embarque e inspeção (janela, inspetora,
  documentos exigidos) · Marcos. Criar dentro do contrato NÃO é <form> (form aninhado): chama a server action
  com FormData montado e a action devolve `id` em `ActionState` para a tela selecionar o item novo.
- **Calado do navio** (`caladoLimite`) = menor calado dos portos em que o NAVIO opera: com transbordo, transbordo +
  descarga; sem, carga + descarga. Terminal fluvial antes do transbordo é da barcaça e não limita o navio.
  Laytime = volume ÷ taxa diária; frete principal pelo Incoterm 2020 (C e D: vendedor; E e F: comprador).
- O NAVIO REAL de cada carga fica para os embarques; o contrato guarda os termos e o navio nomeado, se houver.
- Tabelas e painéis dentro de cartões: `min-w-0 flex-1 basis-64` no resumo (components/cadastros/Cadastro.tsx) e
  `grid-cols-1` nas grades internas — sem isso a tabela aberta empurra a página para fora no celular.

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
- **O SQL Editor do Supabase trunca migration longa.** Aconteceu na 0010 e na 0012, a segunda já com etiqueta
  nomeada. Entregar migration em BLOCOS CURTOS, cada função com etiqueta própria (`$adm$`, `$lanc$`…), e
  conferir depois por `pg_proc`/`pg_policies` — "rodei" não é prova de que entrou inteira.
- **Função PL/pgSQL com `returns table (...)`: TODA coluna do corpo leva prefixo de tabela.** Cada coluna de
  saída vira variável; um `moeda` solto que coincida com ela dá "column reference is ambiguous" — e só na
  CHAMADA, nunca no `create`. Foi assim que a 0016 saiu quebrada. "Criou sem erro" não prova nada: função nova
  ganha teste em `tests/schemaN.test.sql`, rodado num Postgres local antes de entregar.
- **Trava entre tabelas: chave estrangeira COMPOSTA, não trigger.** A 0018 nasceu com uma trigger PL/pgSQL e o
  SQL Editor partiu o corpo dela no meio mesmo com etiqueta nomeada (`$ctr$`). "Mesma empresa" virou
  `foreign key (x_id, organizacao_id) references tabela (id, organizacao_id)` + índice único `(id, organizacao_id)`
  do lado referenciado: declarativo, sem corpo para o editor quebrar, e o banco garante sozinho. Função PL/pgSQL
  nova só quando não houver alternativa declarativa.
- **Projeto só entra em empresa de quem grava** (0019, política RESTRITIVA em `projetos`): o RLS antigo deixava o
  dono gravar qualquer `organizacao_id`; a tela conferia e o banco não. Travas de acesso vão no banco, sempre.
- **Empresa do usuário é por filiação** (`minha_organizacao()`), nunca "a primeira linha que o RLS deixa ver": o
  master enxerga todas as `organizacoes`, e a primeira visível seria a de outra empresa.

## Ambiente do usuário

Windows + PowerShell 5; projeto dentro do OneDrive. Ao sugerir comandos: um bloco que funcione colado numa linha (separar com `;`), `Expand-Archive -LiteralPath`, `Set-Content` sempre com `-Encoding UTF8` (ou `[IO.File]::WriteAllText` sem BOM para `.env.local`). Dev server e OneDrive conflitam: se aparecer erro estranho de React/`useContext`, apagar `.next`.

## Próximos passos possíveis

- Convite com link/e-mail automático (hoje o dono avisa o sócio por fora)
- Histórico de alterações (quem editou o quê)
- Projeção de fluxo futuro (lançamentos planejados), além dos cenários sobre o histórico
