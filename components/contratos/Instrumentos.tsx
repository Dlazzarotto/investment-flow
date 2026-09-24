"use client";
import { useState } from "react";
import {
  criarInstrumento, criarMonetizacao, excluirInstrumento, excluirMonetizacao, mudarStatusInstrumento, mudarStatusMonetizacao,
} from "@/app/actions/contratos";
import { Mensagem } from "@/components/ui/Mensagem";
import { SelectAutoSubmit } from "@/components/ui/SelectAutoSubmit";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { comissaoMonetizacao, valorMonetizado, type AlertaInstrumento } from "@/lib/contratos";
import {
  MOEDAS, STATUS_INSTRUMENTO, STATUS_MONETIZACAO, TIPOS_INSTRUMENTO,
  type Cliente, type Instrumento, type Moeda, type Monetizacao, type Projeto,
} from "@/lib/types";

interface Props {
  organizacaoId: string;
  contratoId: string;
  moeda: Moeda;
  instrumentos: Instrumento[];
  monetizacoes: Monetizacao[];
  alertas: AlertaInstrumento[];
  clientes: Cliente[];
  projetos: Projeto[];
  /** Financial Partner e vendedor do contrato, para já virem escolhidos. */
  fpContrato: string | null;
  vendedorContrato: string | null;
  projetoContrato: string | null;
}

/**
 * Instrumentos bancários do contrato (DLC / SBLC / LC) e, dentro de cada um, os
 * contratos de monetização. O Financial Partner recebe e administra o
 * instrumento; a empresa negocia a monetização e ganha % do valor MONETIZADO.
 */
export function Instrumentos(p: Props) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.instrumentos;
  const nome = new Map(p.clientes.map((c) => [c.id, c.nome]));
  const financiais = p.clientes.filter((c) => c.tipos.includes("financial_partner"));

  return (
    <div className="grid gap-4">
      {p.instrumentos.length === 0 && <p className="text-stone">{t.vazio}</p>}
      {p.instrumentos.map((i) => {
        const alertas = p.alertas.filter((a) => a.instrumento_id === i.id);
        const mons = p.monetizacoes.filter((m) => m.instrumento_id === i.id);
        return (
          <article key={i.id} className="rounded-md border border-stone-light bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-navy">
                  {d.enums.tipoInstrumento[i.tipo]} · {i.numero ?? t.semNumero}
                </p>
                <p className="num mt-1">{f.moeda(Number(i.valor_face), i.moeda)} <span className="text-stone">({t.valorFace})</span></p>
                <p className="mt-1 text-stone">
                  {[i.banco_emissor, i.financial_partner_id ? nome.get(i.financial_partner_id) : t.semFp,
                    i.validade ? `${t.validade}: ${f.data(i.validade)}` : null,
                    i.prazo_apresentacao ? `${t.prazoApresentacao}: ${f.data(i.prazo_apresentacao)}` : null,
                  ].filter(Boolean).join(" · ")}
                </p>
                {alertas.map((a) => (
                  <p key={a.motivo} role="alert" className="mt-2 rounded-md border-l-4 border-loss bg-red-50 px-3 py-2 font-semibold text-loss">
                    {a.dias < 0 ? fmtTexto(t.atrasado, { dias: -a.dias })
                      : fmtTexto(a.motivo === "apresentacao" ? t.alertaApresentacao : t.alertaValidade, { dias: a.dias })}
                  </p>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <form action={mudarStatusInstrumento}>
                  <input type="hidden" name="id" value={i.id} />
                  <SelectAutoSubmit name="status" defaultValue={i.status} className="campo w-auto" ariaLabel={t.status}>
                    {STATUS_INSTRUMENTO.map((s) => <option key={s} value={s}>{d.enums.statusInstrumento[s]}</option>)}
                  </SelectAutoSubmit>
                </form>
                <form action={excluirInstrumento}
                      onSubmit={(e) => { if (!window.confirm(fmtTexto(t.excluirConfirma, { numero: i.numero ?? t.semNumero }))) e.preventDefault(); }}>
                  <input type="hidden" name="id" value={i.id} />
                  <button type="submit" className="btn-perigo px-3">{d.comum.excluir}</button>
                </form>
              </div>
            </div>

            <div className="mt-4 border-t border-stone-light pt-3">
              <h4 className="font-semibold text-navy">{d.monetizacao.titulo}</h4>
              {mons.length === 0 && <p className="mt-1 text-stone">{d.monetizacao.vazio}</p>}
              <ul className="mt-2 grid gap-2">
                {mons.map((m) => (
                  <li key={m.id} className="rounded-md bg-stone-paper p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        {m.numero ?? t.semNumero} · {nome.get(m.financial_partner_id)} → {
                          m.beneficiario_id ? nome.get(m.beneficiario_id)
                            : p.projetos.find((x) => x.id === m.projeto_id)?.nome}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={mudarStatusMonetizacao}>
                          <input type="hidden" name="id" value={m.id} />
                          <SelectAutoSubmit name="status" defaultValue={m.status} className="campo w-auto" ariaLabel={t.status}>
                            {STATUS_MONETIZACAO.map((s) => <option key={s} value={s}>{d.enums.statusMonetizacao[s]}</option>)}
                          </SelectAutoSubmit>
                        </form>
                        <form action={excluirMonetizacao}
                              onSubmit={(e) => { if (!window.confirm(d.monetizacao.excluirConfirma)) e.preventDefault(); }}>
                          <input type="hidden" name="id" value={m.id} />
                          <button type="submit" className="btn-perigo px-3">{d.comum.excluir}</button>
                        </form>
                      </div>
                    </div>
                    <dl className="mt-2 grid gap-2 sm:grid-cols-3">
                      <div><dt className="text-sm text-stone">{fmtTexto(d.monetizacao.pctDoFace, { pct: f.numero(Number(m.pct_monetizacao), 2) })}</dt>
                        <dd className="num font-semibold">{f.moeda(valorMonetizado(i.valor_face, m.pct_monetizacao), i.moeda)}</dd></div>
                      <div><dt className="text-sm text-stone">{fmtTexto(d.monetizacao.comissaoEmpresa, { pct: f.numero(Number(m.comissao_pct), 2) })}</dt>
                        <dd className="num font-semibold text-gain">{f.moeda(comissaoMonetizacao(i.valor_face, m.pct_monetizacao, m.comissao_pct), i.moeda)}</dd></div>
                    </dl>
                  </li>
                ))}
              </ul>
              <NovaMonetizacao {...p} instrumento={i} financiais={financiais} />
            </div>
          </article>
        );
      })}
      <NovoInstrumento {...p} financiais={financiais} />
    </div>
  );
}

function NovoInstrumento(p: Props & { financiais: Cliente[] }) {
  const { d } = useI18n();
  const t = d.instrumentos;
  const [aberto, setAberto] = useState(false);
  const [estado, formAction] = useAcaoFormulario(criarInstrumento);
  if (!aberto) {
    return <button type="button" className="btn-quieto justify-self-start" onClick={() => setAberto(true)}>+ {t.novo}</button>;
  }
  return (
    <form key={estado.versao} action={formAction} className="grid gap-4 rounded-md border border-navy bg-navy-soft/40 p-4 sm:grid-cols-6">
      <input type="hidden" name="organizacao_id" value={p.organizacaoId} />
      <input type="hidden" name="contrato_id" value={p.contratoId} />
      <Campo col={2} rotulo={t.tipo} id="i-tipo">
        <select id="i-tipo" name="tipo" className="campo">
          {TIPOS_INSTRUMENTO.map((x) => <option key={x} value={x}>{d.enums.tipoInstrumento[x]}</option>)}
        </select>
      </Campo>
      <Campo col={4} rotulo={t.financialPartner} id="i-fp">
        <select id="i-fp" name="financial_partner_id" className="campo" defaultValue={p.fpContrato ?? ""}>
          <option value="">{t.semFp}</option>
          {p.financiais.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>
      <Campo col={3} rotulo={t.bancoEmissor} id="i-banco"><input id="i-banco" name="banco_emissor" maxLength={160} className="campo" /></Campo>
      <Campo col={3} rotulo={t.numero} id="i-num"><input id="i-num" name="numero" maxLength={80} className="campo" /></Campo>
      <Campo col={3} rotulo={t.valorFace} id="i-valor">
        <input id="i-valor" name="valor_face" type="number" inputMode="decimal" step="any" min="0" required className="campo num" />
      </Campo>
      <Campo col={3} rotulo={t.moeda} id="i-moeda">
        <select id="i-moeda" name="moeda" className="campo" defaultValue={p.moeda}>
          {MOEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </Campo>
      <Campo col={2} rotulo={t.dataEmissao} id="i-emi"><input id="i-emi" name="data_emissao" type="date" className="campo" /></Campo>
      <Campo col={2} rotulo={t.validade} id="i-val"><input id="i-val" name="validade" type="date" className="campo" /></Campo>
      <Campo col={2} rotulo={t.prazoApresentacao} id="i-apr"><input id="i-apr" name="prazo_apresentacao" type="date" className="campo" /></Campo>
      <Campo col={3} rotulo={t.status} id="i-status">
        <select id="i-status" name="status" className="campo" defaultValue="solicitado">
          {STATUS_INSTRUMENTO.map((x) => <option key={x} value={x}>{d.enums.statusInstrumento[x]}</option>)}
        </select>
      </Campo>
      <Campo col={6} rotulo={t.observacoes} id="i-obs"><input id="i-obs" name="observacoes" maxLength={2000} className="campo" /></Campo>
      <div className="flex flex-wrap gap-3 sm:col-span-6">
        <SubmitButton>{t.salvar}</SubmitButton>
        <button type="button" className="btn-quieto" onClick={() => setAberto(false)}>{d.comum.cancelar}</button>
      </div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}

function NovaMonetizacao(p: Props & { instrumento: Instrumento; financiais: Cliente[] }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.monetizacao;
  const [aberto, setAberto] = useState(false);
  const [destino, setDestino] = useState<"vendedor" | "projeto">(p.projetoContrato ? "projeto" : "vendedor");
  const [pct, setPct] = useState("");
  const [comissao, setComissao] = useState("5");
  const [estado, formAction] = useAcaoFormulario(criarMonetizacao);
  const face = Number(p.instrumento.valor_face);
  const nPct = Number(pct.replace(",", "."));
  const nCom = Number(comissao.replace(",", "."));
  if (!aberto) {
    return <button type="button" className="btn-quieto mt-3" onClick={() => setAberto(true)}>+ {t.nova}</button>;
  }
  const id = p.instrumento.id;
  return (
    <form key={estado.versao} action={formAction} className="mt-3 grid gap-4 rounded-md border border-navy bg-navy-soft/40 p-4 sm:grid-cols-6">
      <input type="hidden" name="organizacao_id" value={p.organizacaoId} />
      <input type="hidden" name="instrumento_id" value={id} />
      <Campo col={2} rotulo={t.numero} id={`m-num-${id}`}><input id={`m-num-${id}`} name="numero" maxLength={60} className="campo" /></Campo>
      <Campo col={4} rotulo={t.financialPartner} id={`m-fp-${id}`}>
        <select id={`m-fp-${id}`} name="financial_partner_id" required className="campo"
                defaultValue={p.instrumento.financial_partner_id ?? p.fpContrato ?? ""}>
          <option value="" disabled>{d.contratos.escolha}</option>
          {p.financiais.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>
      <Campo col={2} rotulo={t.destino} id={`m-dest-${id}`}>
        <select id={`m-dest-${id}`} className="campo" value={destino} onChange={(e) => setDestino(e.target.value as typeof destino)}>
          <option value="vendedor">{t.destinoVendedor}</option>
          <option value="projeto">{t.destinoProjeto}</option>
        </select>
      </Campo>
      {destino === "vendedor" ? (
        <Campo col={4} rotulo={t.beneficiario} id={`m-ben-${id}`}>
          <select id={`m-ben-${id}`} name="beneficiario_id" required className="campo" defaultValue={p.vendedorContrato ?? ""}>
            <option value="" disabled>{d.contratos.escolha}</option>
            {p.clientes.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
      ) : (
        <Campo col={4} rotulo={t.projeto} id={`m-proj-${id}`}>
          <select id={`m-proj-${id}`} name="projeto_id" required className="campo" defaultValue={p.projetoContrato ?? ""}>
            <option value="" disabled>{d.contratos.escolha}</option>
            {p.projetos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </Campo>
      )}
      <Campo col={3} rotulo={t.pctMonetizacao} id={`m-pct-${id}`}>
        <input id={`m-pct-${id}`} name="pct_monetizacao" type="number" inputMode="decimal" step="any" min="0" max="100" required
               className="campo num" value={pct} onChange={(e) => setPct(e.target.value)} />
      </Campo>
      <Campo col={3} rotulo={t.comissaoPct} id={`m-com-${id}`}>
        <input id={`m-com-${id}`} name="comissao_pct" type="number" inputMode="decimal" step="any" min="0" max="100"
               className="campo num" value={comissao} onChange={(e) => setComissao(e.target.value)} />
      </Campo>
      {/* A conta na hora, para ninguém confundir % do face com % do monetizado. */}
      {nPct > 0 && (
        <p className="rounded-md bg-white px-3 py-2 sm:col-span-6">
          {fmtTexto(t.previa, {
            monetizado: f.moeda(valorMonetizado(face, nPct), p.instrumento.moeda),
            comissao: f.moeda(comissaoMonetizacao(face, nPct, nCom || 0), p.instrumento.moeda),
          })}
        </p>
      )}
      <Campo col={2} rotulo={t.status} id={`m-st-${id}`}>
        <select id={`m-st-${id}`} name="status" className="campo" defaultValue="negociacao">
          {STATUS_MONETIZACAO.map((x) => <option key={x} value={x}>{d.enums.statusMonetizacao[x]}</option>)}
        </select>
      </Campo>
      <Campo col={2} rotulo={t.dataOferta} id={`m-of-${id}`}><input id={`m-of-${id}`} name="data_oferta" type="date" className="campo" /></Campo>
      <Campo col={2} rotulo={t.dataPagamento} id={`m-pg-${id}`}><input id={`m-pg-${id}`} name="data_pagamento" type="date" className="campo" /></Campo>
      <div className="flex flex-wrap gap-3 sm:col-span-6">
        <SubmitButton>{t.salvar}</SubmitButton>
        <button type="button" className="btn-quieto" onClick={() => setAberto(false)}>{d.comum.cancelar}</button>
      </div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}

function Campo({ col, rotulo, id, children }: { col: number; rotulo: string; id: string; children: React.ReactNode }) {
  const span = { 2: "sm:col-span-2", 3: "sm:col-span-3", 4: "sm:col-span-4", 6: "sm:col-span-6" }[col] ?? "sm:col-span-6";
  return (
    <div className={span}>
      <label className="rotulo" htmlFor={id}>{rotulo}</label>
      {children}
    </div>
  );
}
