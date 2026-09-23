"use client";
import { useState } from "react";
import {
  atualizarCommodity, criarCommodity, criarParametro, excluirCommodity, excluirParametro,
} from "@/app/actions/cadastros";
import { Cadastro } from "./Cadastro";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto, rotuloUnidade } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import type { Commodity, CommodityParametro } from "@/lib/types";

interface Props {
  commodities: Commodity[];
  parametros: CommodityParametro[];
  organizacaoId: string;
}

export function ListaCommodities({ commodities, parametros, organizacaoId }: Props) {
  const { d } = useI18n();
  const t = d.cadastros;

  const porCommodity = new Map<string, CommodityParametro[]>();
  for (const p of parametros) {
    const lista = porCommodity.get(p.commodity_id) ?? [];
    lista.push(p);
    porCommodity.set(p.commodity_id, lista);
  }

  return (
    <Cadastro<Commodity>
      itens={commodities} organizacaoId={organizacaoId}
      criar={criarCommodity} atualizar={atualizarCommodity} excluir={excluirCommodity}
      rotuloNovo={t.novaCommodity} vazioTitulo={t.semCommodities} vazioTexto={t.semCommoditiesTexto}
      chave={(c) => c.id} nome={(c) => c.nome}
      confirmacao={(c) => fmtTexto(t.excluirCommodity, { nome: c.nome })}
      resumo={(c) => (
        <>
          <p className="font-semibold text-navy">
            {c.nome}
            {!c.ativo && <span className="ml-2 rounded bg-stone-light px-2 py-0.5 text-sm text-stone">{t.inativo}</span>}
          </p>
          <p className="mt-1 text-stone">
            {[c.categoria, rotuloUnidade(c.unidade_padrao, d), c.bolsa].filter(Boolean).join(" · ")}
          </p>
          <Parametros commodityId={c.id} itens={porCommodity.get(c.id) ?? []} />
        </>
      )}
      campos={(c) => {
        const id = c?.id ?? "novo";
        return (
          <>
            <div className="sm:col-span-4">
              <label className="rotulo" htmlFor={`cnome-${id}`}>{t.nome}</label>
              <input id={`cnome-${id}`} name="nome" required maxLength={160} className="campo" defaultValue={c?.nome} />
            </div>
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor={`ccat-${id}`}>{t.categoria}</label>
              <input id={`ccat-${id}`} name="categoria" maxLength={80} className="campo"
                     placeholder={t.categoriaPlaceholder} defaultValue={c?.categoria ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor={`cuni-${id}`}>{t.unidadePadrao}</label>
              <input id={`cuni-${id}`} name="unidade_padrao" required maxLength={40} className="campo"
                     defaultValue={c?.unidade_padrao ?? "Toneladas"} />
            </div>
            <div className="sm:col-span-4">
              <label className="rotulo" htmlFor={`cbol-${id}`}>{t.bolsa}</label>
              <input id={`cbol-${id}`} name="bolsa" maxLength={160} className="campo"
                     placeholder={t.bolsaPlaceholder} defaultValue={c?.bolsa ?? ""} />
            </div>
            <div className="sm:col-span-6">
              <label className="rotulo" htmlFor={`cobs-${id}`}>{t.observacoes}</label>
              <input id={`cobs-${id}`} name="observacoes" maxLength={2000} className="campo" defaultValue={c?.observacoes ?? ""} />
            </div>
            <label className="flex min-h-touch items-center gap-3 sm:col-span-6">
              <input type="checkbox" name="ativo" defaultChecked={c?.ativo ?? true} className="h-6 w-6 accent-navy" />
              <span>{t.ativo}</span>
            </label>
          </>
        );
      }}
    />
  );
}

/**
 * Os parâmetros de qualidade de uma commodity. Ficam dentro da ficha porque
 * "Fe 62 %" sozinho não quer dizer nada — é qualidade DAQUELE minério.
 */
function Parametros({ commodityId, itens }: { commodityId: string; itens: CommodityParametro[] }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.cadastros;
  const [aberto, setAberto] = useState(false);

  return (
    <div className="mt-3">
      <button type="button" className="btn-quieto px-3 text-sm" onClick={() => setAberto(!aberto)}>
        {t.parametros} ({itens.length})
      </button>

      {aberto && (
        <div className="mt-3 rounded-md border border-stone-light bg-stone-paper p-3">
          {itens.length === 0 ? (
            <p className="text-stone">{t.semParametros}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>{t.parametroNome}</th><th className="num">{t.referencia}</th>
                    <th className="num">{t.minimo}</th><th className="num">{t.maximo}</th>
                    <th className="num">{t.ajustePorPonto}</th><th>{d.comum.acoes}</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.nome} <span className="text-stone">({p.unidade})</span></td>
                      <td className="num">{p.referencia === null ? "—" : f.numero(Number(p.referencia), 2)}</td>
                      <td className="num">{p.minimo === null ? "—" : f.numero(Number(p.minimo), 2)}</td>
                      <td className="num">{p.maximo === null ? "—" : f.numero(Number(p.maximo), 2)}</td>
                      <td className={`num font-semibold ${Number(p.ajuste_por_ponto) < 0 ? "text-loss" : "text-navy"}`}>
                        {f.numero(Number(p.ajuste_por_ponto), 2)}
                      </td>
                      <td>
                        <form action={excluirParametro}
                              onSubmit={(e) => { if (!window.confirm(fmtTexto(t.excluirParametro, { nome: p.nome }))) e.preventDefault(); }}>
                          <input type="hidden" name="id" value={p.id} />
                          <button type="submit" className="btn-perigo px-3">{d.comum.excluir}</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <FormParametro commodityId={commodityId} />
          <p className="mt-2 text-sm text-stone">{t.ajusteAjuda}</p>
        </div>
      )}
    </div>
  );
}

function FormParametro({ commodityId }: { commodityId: string }) {
  const { d } = useI18n();
  const t = d.cadastros;
  const [estado, formAction] = useAcaoFormulario(criarParametro);
  return (
    <form key={estado.versao} action={formAction} className="mt-3 grid gap-3 sm:grid-cols-6">
      <input type="hidden" name="commodity_id" value={commodityId} />
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`pnome-${commodityId}`}>{t.parametroNome}</label>
        <input id={`pnome-${commodityId}`} name="nome" required maxLength={80} className="campo"
               placeholder={t.parametroNomePlaceholder} />
      </div>
      <div className="sm:col-span-1">
        <label className="rotulo" htmlFor={`puni-${commodityId}`}>{d.comum.unidade}</label>
        <input id={`puni-${commodityId}`} name="unidade" required maxLength={20} className="campo" defaultValue="%" />
      </div>
      <div className="sm:col-span-1">
        <label className="rotulo" htmlFor={`pref-${commodityId}`}>{t.referencia}</label>
        <input id={`pref-${commodityId}`} name="referencia" type="number" inputMode="decimal" step="any" className="campo num" />
      </div>
      <div className="sm:col-span-1">
        <label className="rotulo" htmlFor={`pmin-${commodityId}`}>{t.minimo}</label>
        <input id={`pmin-${commodityId}`} name="minimo" type="number" inputMode="decimal" step="any" className="campo num" />
      </div>
      <div className="sm:col-span-1">
        <label className="rotulo" htmlFor={`pmax-${commodityId}`}>{t.maximo}</label>
        <input id={`pmax-${commodityId}`} name="maximo" type="number" inputMode="decimal" step="any" className="campo num" />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`paj-${commodityId}`}>{t.ajustePorPonto}</label>
        {/* Sem min: sílica e umidade derrubam o preço, então negativo é válido. */}
        <input id={`paj-${commodityId}`} name="ajuste_por_ponto" type="number" inputMode="decimal" step="any"
               className="campo num" defaultValue={0} />
      </div>
      <div className="sm:col-span-4 flex items-end">
        <SubmitButton className="btn-quieto">{t.novoParametro}</SubmitButton>
      </div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
