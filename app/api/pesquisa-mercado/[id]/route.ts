import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterD } from "@/lib/i18n/server";
import { extrairCotacao, extrairCotacoesBolsas } from "@/lib/pesquisa";
import { consultarPesquisa, encerrarPesquisa, erroPermanente, pesquisaConfigurada } from "@/lib/ia/pesquisador";
import { fmtTexto } from "@/lib/i18n";
import { traduzirErroBanco } from "@/app/actions/erros";
import type { PesquisaMercado } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Pesquisa parada há mais que isto sem terminar é dada como falha (o agente não responde mais). */
const LIMITE_MINUTOS = 20;

/**
 * GET /api/pesquisa-mercado/[id] — andamento da pesquisa. Enquanto o agente
 * trabalha, devolve "pesquisando"; quando termina, grava a resposta e a
 * referência de preço e devolve a linha completa. O RLS decide quem lê: a sessão
 * do agente só é consultada para pesquisa que a pessoa já enxerga.
 */
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { d } = obterD();
  const supabase = createClient();
  const { data } = await supabase.from("pesquisas_mercado").select("*").eq("id", params.id).maybeSingle();
  if (!data) return NextResponse.json({ erro: d.banco.naoEncontrado }, { status: 404 });
  const p = data as PesquisaMercado;
  if (p.status !== "pesquisando") return NextResponse.json({ pesquisa: p });

  const fim = new Date().toISOString();
  const esgotou = Date.now() - new Date(p.criado_em).getTime() > LIMITE_MINUTOS * 60_000;
  let atualizacao: Partial<PesquisaMercado> | null = null;
  // O limite de tempo vale ANTES de tudo: sem sessão (o update do POST falhou) ou sem
  // configuração, a pesquisa não pode ficar "pesquisando" para sempre travando o botão.
  if (!p.sessao_id || !pesquisaConfigurada()) {
    if (!esgotou) return NextResponse.json({ pesquisa: p });
    atualizacao = { status: "falhou", concluida_em: fim, erro: d.pesquisa.tempoEsgotado };
  } else {
    try {
      const a = await consultarPesquisa(p.sessao_id);
      if (a.estado === "concluida") {
        const c = extrairCotacao(a.texto);
        atualizacao = {
          status: "concluida", concluida_em: fim, resposta: a.texto.slice(0, 40000), custo_usd: a.custoUsd,
          preco: c?.preco ?? null, moeda: c?.moeda ?? null, unidade: c?.unidade ?? null, base_cotacao: c?.base ?? null,
          especificacao: c?.especificacao ?? null, data_cotacao: c?.data ?? null, tipo: c?.tipo ?? null,
          fonte: c?.fonte ?? null, url: c?.url ?? null, aproximacao: c?.aproximacao ?? null,
          ...(p.modo === "bolsas" ? { cotacoes: extrairCotacoesBolsas(a.texto) } : {}),
        };
      } else if (a.estado === "falhou") {
        const erro = { orcamento: d.pesquisa.orcamento, aprovacao: d.pesquisa.aprovacao, encerrada: d.pesquisa.encerrada,
          erro: a.detalhe ?? d.pesquisa.falhouGenerico }[a.motivo];
        atualizacao = { status: "falhou", concluida_em: fim, erro, custo_usd: a.custoUsd };
      } else if (esgotou) {
        await encerrarPesquisa(p.sessao_id);
        atualizacao = { status: "falhou", concluida_em: fim, erro: d.pesquisa.tempoEsgotado };
      }
    } catch (e) {
      // Rede, 429 e 5xx passam: a tela tenta de novo. Sessão inexistente ou chave de outro
      // workspace não passam — viram falha, senão a consulta se repetiria para sempre.
      if (!erroPermanente(e) && !esgotou) return NextResponse.json({ pesquisa: p });
      atualizacao = { status: "falhou", concluida_em: fim,
        erro: fmtTexto(d.pesquisa.falhou, { msg: e instanceof Error ? e.message : d.pesquisa.falhouGenerico }) };
    }
  }
  if (!atualizacao) return NextResponse.json({ pesquisa: p });
  // O check do banco limita o erro a 1000 caracteres: texto maior faria o update falhar sempre.
  if (atualizacao.erro) atualizacao.erro = atualizacao.erro.slice(0, 1000);
  const { data: salvo, error } = await supabase.from("pesquisas_mercado").update(atualizacao)
    .eq("id", p.id).eq("status", "pesquisando").select("*").maybeSingle();
  if (error) return NextResponse.json({ erro: traduzirErroBanco(error, "commodity", d) }, { status: 500 });
  revalidatePath("/commodities");
  revalidatePath("/painel");
  return NextResponse.json({ pesquisa: (salvo as PesquisaMercado | null) ?? { ...p, ...atualizacao } });
}
