"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { Mensagem } from "@/components/ui/Mensagem";
import { CartaoPesquisa } from "./CartaoPesquisa";
import { pedirPesquisa, useAcompanharPesquisas } from "./acompanhar";
import type { Commodity, CommodityGrade, PesquisaMercado as Pesquisa } from "@/lib/types";

/**
 * Pesquisa de mercado na aba Commodities: escolhe a commodity (e o grade e a base,
 * se quiser), o agente pesquisa, e o resultado fica no histórico da commodity.
 */
export function PesquisaMercado({ commodities, grades, pesquisas, configurada }:
  { commodities: Commodity[]; grades: CommodityGrade[]; pesquisas: Pesquisa[]; configurada: boolean }) {
  const { d } = useI18n();
  const t = d.pesquisa;
  const ativas = commodities.filter((c) => c.ativo);
  const [commodity, setCommodity] = useState(ativas[0]?.id ?? "");
  const [grade, setGrade] = useState("");
  const [base, setBase] = useState("");
  const [detalhado, setDetalhado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const { ativas: emAndamento, acompanhar } = useAcompanharPesquisas(pesquisas.filter((p) => p.status === "pesquisando").map((p) => p.id));

  if (!configurada) return <p className="rounded-md border-l-4 border-orange bg-orange-soft px-4 py-3">{t.naoConfigurada}</p>;
  if (ativas.length === 0) return <p className="text-stone">{t.semCommodities}</p>;

  const historico = pesquisas.filter((p) => p.commodity_id === commodity).slice(0, 10);
  const gradesDela = grades.filter((g) => g.commodity_id === commodity && g.ativo);
  const pesquisar = () => {
    setErro(null);
    iniciar(async () => {
      const r = await pedirPesquisa({ commodity_id: commodity, grade_id: grade || undefined, base: base || undefined, detalhado });
      if (r.erro) setErro(r.erro); else if (r.id) { acompanhar(r.id); router.refresh(); }
    });
  };

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <label className="rotulo" htmlFor="pm-commodity">{t.commodity}</label>
          <select id="pm-commodity" className="campo" value={commodity} onChange={(e) => { setCommodity(e.target.value); setGrade(""); }}>
            {ativas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="rotulo" htmlFor="pm-grade">{t.grade}</label>
          <select id="pm-grade" className="campo" value={grade} onChange={(e) => setGrade(e.target.value)} disabled={gradesDela.length === 0}>
            <option value="">{t.qualquerGrade}</option>
            {gradesDela.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="rotulo" htmlFor="pm-base">{t.base}</label>
          <input id="pm-base" className="campo" maxLength={160} value={base} placeholder={t.basePlaceholder}
                 onChange={(e) => setBase(e.target.value)} />
        </div>
        <label className="flex min-h-touch items-center gap-3 sm:col-span-4">
          <input type="checkbox" className="h-6 w-6 accent-navy" checked={detalhado} onChange={(e) => setDetalhado(e.target.checked)} />
          <span>{t.detalhado}</span>
        </label>
        <div className="sm:col-span-2 sm:text-right">
          <button type="button" className="btn-primario w-full sm:w-auto" disabled={pendente || !commodity} aria-busy={pendente} onClick={pesquisar}>
            {t.pesquisar}
          </button>
        </div>
      </div>
      {erro && <div className="mt-3"><Mensagem estado={{ ok: false, erro }} /></div>}

      <h3 className="mb-2 mt-6 text-lg text-navy">{t.historico}</h3>
      {historico.length === 0 ? <p className="text-stone">{t.semHistorico}</p> : (
        <ul className="grid grid-cols-1 gap-3">
          {historico.map((p) => <li key={p.id}><CartaoPesquisa p={p} pesquisando={emAndamento.includes(p.id)} /></li>)}
        </ul>
      )}
    </div>
  );
}
