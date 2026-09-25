import Anthropic from "@anthropic-ai/sdk";

/**
 * O agente "Pesquisador de Commodities" (Claude Managed Agents). O agente e o
 * ambiente são criados e ajustados no Console da Anthropic (a instrução, o modelo
 * e as ferramentas moram lá, versionados); aqui só abrimos SESSÕES com os ids.
 *
 * Por que sessão e não uma chamada que espera a resposta: a pesquisa leva de 1 a
 * 5 minutos (várias buscas e leituras), mais do que uma rota da Vercel deve ficar
 * aberta. Abrir a sessão é instantâneo; a tela consulta o andamento a cada poucos
 * segundos e, quando o agente termina, lemos os eventos e gravamos o resultado.
 */

export function pesquisaConfigurada(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.PESQUISA_AGENT_ID && process.env.PESQUISA_ENVIRONMENT_ID);
}

function cliente(): Anthropic {
  return new Anthropic(); // lê ANTHROPIC_API_KEY — tem que ser do MESMO workspace do agente
}

/** Teto de custo por pesquisa, em centavos de dólar (padrão US$ 2,00). O agente para sozinho ao atingir. */
function orcamentoCentavos(): string {
  const usd = Number(process.env.PESQUISA_ORCAMENTO_USD ?? "2");
  const centavos = Math.round((Number.isFinite(usd) && usd > 0 ? usd : 2) * 100);
  return String(Math.max(centavos, 10));
}

export async function iniciarPesquisa(pergunta: string, titulo: string, metadata: Record<string, string>): Promise<string> {
  const sessao = await cliente().beta.sessions.create({
    agent: process.env.PESQUISA_AGENT_ID!,
    environment_id: process.env.PESQUISA_ENVIRONMENT_ID!,
    title: titulo.slice(0, 200),
    metadata,
    budget: { type: "limit", max_list_cost: { amount: orcamentoCentavos(), currency: "USD" } },
    // Cria já trabalhando: a sessão nasce em "running", sem passo extra de envio.
    initial_events: [{ type: "user.message", content: [{ type: "text", text: pergunta }] }],
  });
  return sessao.id;
}

export type Andamento =
  | { estado: "pesquisando" }
  | { estado: "concluida"; texto: string; custoUsd: number | null }
  | { estado: "falhou"; motivo: "orcamento" | "aprovacao" | "erro" | "encerrada"; detalhe: string | null; custoUsd: number | null };

/**
 * Onde a sessão está. Terminou quando fica "idle" com motivo end_turn; aí o texto
 * é o que o agente escreveu depois da ÚLTIMA pergunta (as mensagens intermediárias
 * — "vou buscar…" — também entram; o JSON está no fim).
 */
export async function consultarPesquisa(sessaoId: string): Promise<Andamento> {
  const api = cliente();
  const sessao = await api.beta.sessions.retrieve(sessaoId);
  const custo = sessao.usage?.list_cost?.amount ? Number(sessao.usage.list_cost.amount) / 100 : null;
  if (sessao.status === "running" || sessao.status === "rescheduling") return { estado: "pesquisando" };

  let textos: string[] = [];
  let parada: string | null = null;
  let erro: string | null = null;
  for await (const ev of api.beta.sessions.events.list(sessaoId)) {
    if (ev.type === "user.message") { textos = []; }
    else if (ev.type === "agent.message") {
      for (const b of ev.content) if (b.type === "text") textos.push(b.text);
    } else if (ev.type === "session.status_idle") { parada = ev.stop_reason.type; }
    else if (ev.type === "session.error") { erro = ev.error.message; }
  }

  if (sessao.status === "terminated") return { estado: "falhou", motivo: "encerrada", detalhe: erro, custoUsd: custo };
  if (parada === "budget_reached") return { estado: "falhou", motivo: "orcamento", detalhe: null, custoUsd: custo };
  if (parada === "requires_action") return { estado: "falhou", motivo: "aprovacao", detalhe: null, custoUsd: custo };
  if (parada === "retries_exhausted") return { estado: "falhou", motivo: "erro", detalhe: erro, custoUsd: custo };
  if (parada === "end_turn" && textos.length) return { estado: "concluida", texto: textos.join("\n\n"), custoUsd: custo };
  // "idle" sem parada registrada ainda (o evento chega um instante depois): continua pesquisando.
  return { estado: "pesquisando" };
}
