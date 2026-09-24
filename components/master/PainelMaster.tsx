"use client";
import { useState } from "react";
import { CartaoEmpresa } from "./CartaoEmpresa";
import { FormGerarMensalidades } from "./FormFatura";
import { Vazio } from "@/components/ui/Vazio";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import type { EmpresaPlataforma, Fatura, PainelPlataforma } from "@/lib/types";

type Filtro = "todas" | "ativas" | "inativas" | "em_debito" | "a_receber" | "em_atraso";

interface Props { painel: PainelPlataforma[]; empresas: EmpresaPlataforma[]; faturas: Fatura[] }

/**
 * Panorama macro em cima, lista embaixo. Clicar num widget filtra a lista — é o
 * detalhe daquele número, nas mesmas fichas, sem trocar de tela.
 */
export function PainelMaster({ painel, empresas, faturas }: Props) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.master;
  const [filtro, setFiltro] = useState<Filtro>("todas");

  // As contagens repetem em toda linha (empresa não tem moeda, cobrança tem).
  const contagens = painel[0];

  const porEmpresa = new Map<string, Fatura[]>();
  for (const x of faturas) {
    const lista = porEmpresa.get(x.organizacao_id) ?? [];
    lista.push(x);
    porEmpresa.set(x.organizacao_id, lista);
  }

  const filtrada = empresas.filter((e) => {
    switch (filtro) {
      case "ativas": return e.em_dia;
      case "inativas": return !e.em_dia;
      case "em_debito": return e.em_debito;
      case "a_receber": return Number(e.aberto) - Number(e.atrasado) > 0;
      case "em_atraso": return Number(e.atrasado) > 0;
      default: return true;
    }
  });

  const rotuloFiltro: Record<Filtro, string> = {
    todas: t.todas, ativas: t.ativos, inativas: t.inativos,
    em_debito: t.emDebito, a_receber: t.aReceber, em_atraso: t.emAtraso,
  };

  return (
    <>
      <section className="secao">
        <h2>{t.panorama}</h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <Widget rotulo={t.ativos} valor={String(contagens?.ativas ?? 0)} ajuda={t.ativosAjuda}
                  ativo={filtro === "ativas"} aoClicar={() => setFiltro("ativas")} />
          <Widget rotulo={t.inativos} valor={String(contagens?.inativas ?? 0)} ajuda={t.inativosAjuda}
                  ativo={filtro === "inativas"} aoClicar={() => setFiltro("inativas")}
                  alerta={(contagens?.inativas ?? 0) > 0} />
          <Widget rotulo={t.emDebito} valor={String(contagens?.em_debito ?? 0)} ajuda={t.emDebitoAjuda}
                  ativo={filtro === "em_debito"} aoClicar={() => setFiltro("em_debito")}
                  alerta={(contagens?.em_debito ?? 0) > 0} />
        </div>

        {painel.map((p) => (
          <div key={p.moeda} className="mt-3">
            {painel.length > 1 && <p className="mb-2 text-sm font-semibold text-stone">{p.moeda}</p>}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Widget rotulo={t.contratoMensal} valor={f.moeda(Number(p.contrato_mensal), p.moeda)}
                      ajuda={t.contratoMensalAjuda} destaque />
              <Widget rotulo={t.aReceber} valor={f.moeda(Number(p.a_receber), p.moeda)} ajuda={t.aReceberAjuda}
                      ativo={filtro === "a_receber"} aoClicar={() => setFiltro("a_receber")} />
              <Widget rotulo={t.emAtraso} valor={f.moeda(Number(p.em_atraso), p.moeda)} ajuda={t.emAtrasoAjuda}
                      ativo={filtro === "em_atraso"} aoClicar={() => setFiltro("em_atraso")}
                      alerta={Number(p.em_atraso) > 0} />
              <Widget rotulo={t.recebidoMes} valor={f.moeda(Number(p.recebido_mes), p.moeda)} bom />
            </div>
          </div>
        ))}

        <div className="mt-4"><FormGerarMensalidades /></div>
      </section>

      <section className="secao">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="mb-0">{t.lista}</h2>
          {filtro !== "todas" && (
            <p className="text-stone">
              {fmtTexto(t.filtrando, { filtro: rotuloFiltro[filtro] })}{" "}
              <button type="button" className="underline text-navy" onClick={() => setFiltro("todas")}>
                {t.limparFiltro}
              </button>
            </p>
          )}
        </div>
        {filtrada.length === 0 ? (
          <Vazio titulo={filtro === "todas" ? t.vazioTitulo : rotuloFiltro[filtro]}
                 texto={filtro === "todas" ? t.vazioTexto : t.limparFiltro} />
        ) : (
          <div className="grid gap-4">
            {filtrada.map((e) => (
              <CartaoEmpresa key={e.id} empresa={e} faturas={porEmpresa.get(e.id) ?? []} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Widget({ rotulo, valor, ajuda, aoClicar, ativo = false, alerta = false, bom = false, destaque = false }:
  { rotulo: string; valor: string; ajuda?: string; aoClicar?: () => void;
    ativo?: boolean; alerta?: boolean; bom?: boolean; destaque?: boolean }) {
  const { d } = useI18n();
  const cor = alerta ? "text-loss" : bom ? "text-gain" : "text-navy";
  const borda = ativo ? "border-navy bg-navy-soft" : destaque ? "border-navy" : "border-stone-light";
  const conteudo = (
    <>
      <p className="text-sm text-stone">{rotulo}</p>
      {/* text-lg e 4 colunas so no xl: em lg o cartao ficava com 156px para um
          numero de 219px, e o espaco do Intl em "US$ 2.980.000,00" e NAO-QUEBRAVEL,
          entao o texto nao quebra linha — transborda. */}
      <p className={`num mt-1 text-lg font-semibold ${cor}`}>{valor}</p>
      {ajuda && <p className="mt-1 text-sm text-stone">{ajuda}</p>}
    </>
  );

  // Só vira botão o que tem detalhe a mostrar; o resto não finge ser clicável.
  if (!aoClicar) return <div className={`rounded-md border bg-white p-4 ${borda}`}>{conteudo}</div>;
  return (
    <button type="button" onClick={aoClicar} aria-pressed={ativo}
            className={`rounded-md border bg-white p-4 text-left hover:bg-navy-soft ${borda}`}
            aria-label={`${rotulo}: ${valor}. ${d.master.verDetalhe}`}>
      {conteudo}
    </button>
  );
}
