"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { blocosResposta } from "@/lib/pesquisa";
import type { PesquisaMercado } from "@/lib/types";

/** Uma pesquisa: o preço em destaque, de onde veio, e a resposta completa do agente sob demanda. */
export function CartaoPesquisa({ p, pesquisando }: { p: PesquisaMercado; pesquisando: boolean }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.pesquisa;
  const [aberto, setAberto] = useState(false);

  if (p.status === "pesquisando" || pesquisando) {
    return (
      <div className="rounded-md border border-navy bg-navy-soft/60 p-4" role="status" aria-live="polite">
        <p className="font-semibold text-navy"><span className="mr-2 inline-block animate-pulse">●</span>{t.pesquisando}</p>
        <p className="mt-1 text-sm text-stone">{fmtTexto(t.pedidaEm, { data: f.data(p.criado_em) })}{p.base ? ` · ${p.base}` : ""}</p>
      </div>
    );
  }
  if (p.status === "falhou") {
    return (
      <div className="rounded-md border-l-4 border-loss bg-red-50 p-4" role="alert">
        <p className="text-loss">{fmtTexto(t.falhou, { msg: p.erro ?? t.falhouGenerico })}</p>
        <p className="mt-1 text-sm text-stone">{fmtTexto(t.pedidaEm, { data: f.data(p.criado_em) })}</p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-stone-light bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="num text-lg font-semibold text-navy">
          {p.preco === null ? t.semPreco : `${p.moeda ?? ""} ${f.numero(Number(p.preco), 2)}`}
          {p.preco !== null && p.unidade && <span className="ml-1 text-base font-normal text-stone">/ {p.unidade}</span>}
        </p>
        <div className="flex flex-wrap gap-1">
          {p.tipo && <span className="rounded bg-navy-soft px-2 py-0.5 text-sm text-navy">{d.enums.tipoCotacao[p.tipo]}</span>}
          {p.aproximacao && <span className="rounded bg-orange-soft px-2 py-0.5 text-sm text-orange-deep">{t.aproximacao}</span>}
        </div>
      </div>
      <p className="mt-1 text-stone">
        {[p.especificacao, p.base_cotacao ?? p.base, p.data_cotacao ? fmtTexto(t.cotadoEm, { data: f.data(p.data_cotacao) }) : null]
          .filter(Boolean).join(" · ")}
      </p>
      {(p.fonte || p.url) && (
        <p className="mt-1 break-words text-sm">
          {p.fonte}
          {p.url && <> · <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-navy underline">{t.abrirFonte}</a></>}
        </p>
      )}
      {p.resposta && (
        <>
          <button type="button" className="btn-quieto mt-3 px-3" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>{t.verResposta}</button>
          {aberto && <Resposta texto={p.resposta} />}
        </>
      )}
      {p.custo_usd !== null && <p className="mt-2 text-sm text-stone">{fmtTexto(t.custo, { v: f.numero(Number(p.custo_usd), 2) })}</p>}
    </div>
  );
}

/** Texto do agente: parágrafos como vieram (sem interpretar HTML) e as tabelas em tabela de verdade. */
function Resposta({ texto }: { texto: string }) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 border-t border-stone-light pt-3">
      {blocosResposta(texto).map((b, i) => b.tipo === "texto" ? (
        <p key={i} className="whitespace-pre-wrap break-words">{b.texto.replace(/\*\*(.+?)\*\*/g, "$1")}</p>
      ) : (
        <div key={i} className="overflow-x-auto">
          <table className="tabela">
            <thead><tr>{b.cabecalho.map((c, j) => <th key={j}>{c}</th>)}</tr></thead>
            <tbody>{b.linhas.map((l, j) => <tr key={j}>{l.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
