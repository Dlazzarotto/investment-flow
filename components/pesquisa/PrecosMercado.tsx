"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarCommoditiesPainel } from "@/app/actions/painel";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto, rotuloUnidade } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { PRACAS, variacao, type CotacaoBolsa } from "@/lib/pesquisa";
import { pedirPesquisa, useAcompanharPesquisas } from "./acompanhar";
import { OpcoesCommodity } from "./OpcoesCommodity";
import type { Commodity, CommodityPadrao, PesquisaMercado } from "@/lib/types";

interface Posicao { commodity_id: string; unidade: string; venda: number; compra: number }

/** Célula de uma praça: a cotação da última pesquisa e a variação contra a anterior da MESMA bolsa. */
interface Celula { c: CotacaoBolsa; v: number | null }

/**
 * Painel: as até 3 commodities escolhidas pelo usuário, cada uma com três preços —
 * Xangai, Londres e Chicago — da última pesquisa em modo "bolsas". Cada célula diz
 * de que bolsa e contrato veio (minério na China é Dalian, não SHFE); praça sem
 * contrato aparece como "não negociado", nunca com número emprestado. A variação
 * só é mostrada contra a pesquisa anterior da mesma bolsa, moeda e unidade.
 */
export function PrecosMercado({ organizacaoId, commodities, catalogo, escolhidas, pesquisas, posicoes, configurada }: {
  organizacaoId: string; commodities: Commodity[]; catalogo: CommodityPadrao[]; escolhidas: string[]; pesquisas: PesquisaMercado[];
  posicoes: Posicao[]; configurada: boolean;
}) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.precosPainel;
  const router = useRouter();
  const [editando, setEditando] = useState(escolhidas.length === 0);
  const [erro, setErro] = useState<string | null>(null);
  const [pedindo, iniciar] = useTransition();
  const { ativas, acompanhar } = useAcompanharPesquisas(pesquisas.filter((p) => p.status === "pesquisando").map((p) => p.id));

  const linhas = escolhidas.map((id) => commodities.find((c) => c.id === id)).filter((c): c is Commodity => !!c).map((c) => {
    const dela = pesquisas.filter((p) => p.commodity_id === c.id);
    const emCurso = dela.some((p) => p.status === "pesquisando" || ativas.includes(p.id));
    const concluidas = dela.filter((p) => p.status === "concluida");
    const ultima = concluidas[0] ?? null;
    const celulas: Celula[] | null = ultima && PRACAS.map((praca) => {
      const vazia: CotacaoBolsa = { mercado: praca, negociado: null, bolsa: null, contrato: null, preco: null, moeda: null,
        unidade: null, data: null, url: null, aproximacao: null };
      const atual = (ultima.cotacoes ?? []).find((x) => x.mercado === praca) ?? vazia;
      // Só compara com a mesma bolsa e o mesmo vencimento: na rolagem de contrato a diferença é de prazo, não de preço.
      const anterior = concluidas.slice(1).map((p) => (p.cotacoes ?? []).find((x) => x.mercado === praca))
        .find((x) => x && x.preco !== null && x.bolsa === atual.bolsa
          && (!x.contrato || !atual.contrato || x.contrato === atual.contrato));
      return { c: atual, v: anterior ? variacao(atual, anterior) : null };
    });
    const pos = posicoes.filter((x) => x.commodity_id === c.id)
      .map((x) => `${f.numero(x.compra - x.venda, 0)} ${rotuloUnidade(x.unidade, d)}`);
    return { c, ultima, celulas, emCurso, pos };
  });

  const atualizar = (commodityId: string) => {
    setErro(null);
    iniciar(async () => {
      const r = await pedirPesquisa({ commodity_id: commodityId, modo: "bolsas" });
      if (r.erro) setErro(r.erro); else if (r.id) { acompanhar(r.id); router.refresh(); }
    });
  };
  const botao = (l: (typeof linhas)[number]) => configurada && (
    <button type="button" className="btn-quieto px-3" disabled={pedindo || l.emCurso} aria-busy={l.emCurso}
            onClick={() => atualizar(l.c.id)}>
      {l.emCurso ? t.pesquisandoCurto : t.atualizar}
    </button>
  );

  /** Conteúdo de uma célula de praça, igual no cartão e na tabela. */
  /** "USD 104,20 / dmt"; preço miúdo (USD por libra) leva 4 casas; unidade que já traz a moeda ("¢/lb") vai inteira. */
  const valor = (c: CotacaoBolsa) => {
    const n = f.numero(c.preco ?? 0, Math.abs(c.preco ?? 0) < 10 ? 4 : 2);
    return c.unidade?.includes("/") ? `${n} ${c.unidade}` : `${c.moeda ?? ""} ${n}${c.unidade ? ` / ${c.unidade}` : ""}`.trim();
  };
  const celulaPraca = (cel: Celula) => {
    const { c, v } = cel;
    if (c.preco === null) {
      return c.negociado === false
        ? <span className="text-stone" title={t.naoNegociadoAjuda}>{t.naoNegociado}{c.bolsa ? ` · ${c.bolsa}` : ""}</span>
        : <span className="text-stone">{t.naoInformado}</span>;
    }
    const origem = [c.bolsa, c.contrato].filter(Boolean).join(" · ");
    return (
      <span className="block">
        <span className="num block whitespace-nowrap font-semibold text-navy">
          {valor(c)}
        </span>
        {v !== null && <span className={`num block text-sm ${v >= 0 ? "text-gain" : "text-loss"}`} title={t.variacaoAjuda}>
          {v > 0 ? "+" : ""}{f.numero(v, 2)} %</span>}
        {origem && <span className="block text-sm text-stone">
          {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline">{origem}</a> : origem}
        </span>}
        {c.data && <span className="block text-sm text-stone">{f.data(c.data)}</span>}
        {c.aproximacao && <span className="mt-1 inline-block rounded bg-orange-soft px-2 py-0.5 text-sm text-orange-deep">{d.pesquisa.aproximacao}</span>}
      </span>
    );
  };

  return (
    <div>
      {!configurada && <p className="mb-3 rounded-md border-l-4 border-orange bg-orange-soft px-4 py-3">{d.pesquisa.naoConfigurada}</p>}
      {linhas.length === 0 ? <p className="text-stone">{t.vazio}</p> : (
        <>
          {/* Celular: um cartão por commodity, uma linha por praça. Tela larga: tabela. */}
          <ul className="grid grid-cols-1 gap-3 md:hidden">
            {linhas.map((l) => (
              <li key={l.c.id} className="rounded-md border border-stone-light bg-white p-4">
                <p className="font-semibold text-navy">{l.c.nome}</p>
                {l.celulas ? (
                  <dl className="mt-2 divide-y divide-stone-light">
                    {l.celulas.map((cel) => (
                      <div key={cel.c.mercado} className="grid grid-cols-[7rem_1fr] gap-3 py-2">
                        <dt className="text-stone">{d.enums.praca[cel.c.mercado]}</dt>
                        <dd className="min-w-0">{celulaPraca(cel)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : <p className="mt-1 text-stone">{t.semPesquisa}</p>}
                {l.pos.length > 0 && <p className="mt-1 text-sm text-stone">{t.posicao}: <span className="num">{l.pos.join(" · ")}</span></p>}
                <div className="mt-3">{botao(l)}</div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="tabela">
              <thead>
                <tr>
                  <th>{d.pesquisa.commodity}</th>
                  {PRACAS.map((p) => <th key={p}>{d.enums.praca[p]}</th>)}
                  <th className="num" title={t.posicaoAjuda}>{t.posicao}</th><th>{d.comum.acoes}</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.c.id} className="align-top">
                    <td className="font-semibold text-navy">{l.c.nome}</td>
                    {l.celulas
                      ? l.celulas.map((cel) => <td key={cel.c.mercado}>{celulaPraca(cel)}</td>)
                      : <td colSpan={PRACAS.length} className="text-stone">{t.semPesquisa}</td>}
                    <td className="num whitespace-nowrap">{l.pos.length ? l.pos.join(" · ") : "—"}</td>
                    <td>{botao(l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {erro && <div className="mt-3"><Mensagem estado={{ ok: false, erro }} /></div>}

      <button type="button" className="btn-quieto mt-4 px-3" aria-expanded={editando} onClick={() => setEditando(!editando)}>{t.editar}</button>
      {editando && <Escolha organizacaoId={organizacaoId} commodities={commodities} catalogo={catalogo} escolhidas={escolhidas} aoSalvar={() => setEditando(false)} />}
    </div>
  );
}

function Escolha({ organizacaoId, commodities, catalogo, escolhidas, aoSalvar }:
  { organizacaoId: string; commodities: Commodity[]; catalogo: CommodityPadrao[]; escolhidas: string[]; aoSalvar: () => void }) {
  const { d } = useI18n();
  const t = d.precosPainel;
  const [estado, formAction] = useAcaoFormulario(async (s, fd) => {
    const r = await salvarCommoditiesPainel(s, fd);
    if (r.ok) aoSalvar();
    return r;
  });
  return (
    <form action={formAction} className="mt-3 grid gap-3 rounded-md border border-stone-light bg-white p-4 sm:grid-cols-3">
      <input type="hidden" name="organizacao_id" value={organizacaoId} />
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <label className="rotulo" htmlFor={`painel-c${i}`}>{fmtTexto(t.escolher, { n: i + 1 })}</label>
          <select id={`painel-c${i}`} name="commodity_id" className="campo" defaultValue={escolhidas[i] ?? ""}>
            <option value="">{t.nenhuma}</option>
            <OpcoesCommodity commodities={commodities} catalogo={catalogo} incluir={escolhidas} />
          </select>
        </div>
      ))}
      <div className="sm:col-span-3"><SubmitButton>{t.salvar}</SubmitButton></div>
      <div className="sm:col-span-3"><Mensagem estado={estado} /></div>
    </form>
  );
}
