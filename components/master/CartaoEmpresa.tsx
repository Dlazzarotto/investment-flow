"use client";
import { useState } from "react";
import {
  adicionarAdmin, alternarPagamento, atualizarContrato, excluirEmpresa, excluirFatura, mudarSituacaoEmpresa, removerAdmin,
  renomearEmpresa, trocarAdmin,
} from "@/app/actions/master";
import { ConviteAcesso } from "./ConviteAcesso";
import { mesmoNome } from "@/lib/texto";
import { FormFatura } from "./FormFatura";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useHoje } from "@/components/ui/useHoje";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { MOEDAS, PLANOS_EMPRESA, SITUACOES_EMPRESA, type EmpresaPlataforma, type Fatura, type SituacaoEmpresa } from "@/lib/types";
import { FormAcao } from "@/components/ui/FormAcao";

/** Uma empresa: contrato, cobrança, uso e quem administra. */
export function CartaoEmpresa({ empresa: e, faturas }: { empresa: EmpresaPlataforma; faturas: Fatura[] }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.master;
  const [aba, setAba] = useState<"nenhuma" | "contrato" | "faturas">("nenhuma");
  const [renomeando, setRenomeando] = useState(false);

  const vencida = !e.em_dia && e.ativa;
  const uso = e.assentos === null ? `${e.assentos_usados} / ${t.semTeto}` : `${e.assentos_usados} / ${e.assentos}`;
  const cheio = e.assentos !== null && e.assentos_usados >= e.assentos;

  return (
    <article className={`rounded-md border bg-white p-4 ${e.em_debito ? "border-loss" : "border-stone-light"}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg text-navy">{e.nome}</h3>
            <button type="button" className="btn-quieto px-3" aria-expanded={renomeando}
                    onClick={() => setRenomeando(!renomeando)}>{renomeando ? d.comum.cancelar : t.editarNome}</button>
          </div>
          {renomeando && <FormNome id={e.id} nome={e.nome} aoSalvar={() => setRenomeando(false)} />}
          <p className="text-stone">
            {d.enums.planoEmpresa[e.plano]}
            {Number(e.mensalidade) > 0
              ? ` · ${f.moeda(Number(e.mensalidade), e.moeda_cobranca)}/${t.mensalidade.toLowerCase()}`
              : ` · ${t.semCobranca}`}
            {e.vigencia_ate && ` · ${t.vigencia} ${f.data(e.vigencia_ate)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {e.situacao !== "ativa" && <Selo texto={d.enums.situacaoEmpresa[e.situacao]} />}
          {vencida && <Selo texto={t.vencida} />}
          {e.em_debito && <Selo texto={t.emDebito} />}
          <p className="text-stone">
            {t.uso}: <span className={`num font-semibold ${cheio ? "text-loss" : "text-navy"}`}>{uso}</span>
          </p>
          <p className="text-stone">{t.projetos}: <span className="num font-semibold text-navy">{e.projetos}</span></p>
        </div>
      </header>

      {Number(e.aberto) > 0 && (
        <p className="mt-3 text-stone">
          {t.aberto}: <span className="num font-semibold text-navy">{f.moeda(Number(e.aberto), e.moeda_cobranca)}</span>
          {Number(e.atrasado) > 0 && (
            <> · {t.emAtraso}: <span className="num font-semibold text-loss">{f.moeda(Number(e.atrasado), e.moeda_cobranca)}</span></>
          )}
          {e.proximo_vencimento && <> · {t.proximoVencimento}: <span className="num">{f.data(e.proximo_vencimento)}</span></>}
        </p>
      )}

      <Situacao id={e.id} nome={e.nome} atual={e.situacao} />

      <div className="mt-4 border-t border-stone-light pt-4">
        <p className="text-sm font-semibold text-navy">{t.admins}</p>
        <ul className="mt-2 grid gap-2">
          {e.admins.map((email) => (
            <LinhaAdmin key={email} organizacaoId={e.id} empresa={e.nome} email={email} unico={e.admins.length === 1} />
          ))}
        </ul>
        <FormAdmin organizacaoId={e.id} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-light pt-4">
        <button type="button" className="btn-quieto"
                onClick={() => setAba(aba === "contrato" ? "nenhuma" : "contrato")}>{t.contrato}</button>
        <button type="button" className="btn-quieto"
                onClick={() => setAba(aba === "faturas" ? "nenhuma" : "faturas")}>
          {t.faturas} ({faturas.length})
        </button>
      </div>

      {aba === "contrato" && (
        <div className="mt-4">
          <FormContrato empresa={e} aoFechar={() => setAba("nenhuma")} />
          <ExcluirEmpresa id={e.id} nome={e.nome} />
        </div>
      )}
      {aba === "faturas" && <Faturas empresa={e} faturas={faturas} />}
    </article>
  );
}

/**
 * Ativa · Parada · Arquivada (0034). Só a ativa entra no sistema; parar e arquivar
 * pedem confirmação porque tiram o acesso de todo mundo da empresa na hora.
 */
function Situacao({ id, nome, atual }: { id: string; nome: string; atual: SituacaoEmpresa }) {
  const { d } = useI18n();
  const t = d.master;
  const rotulo: Record<SituacaoEmpresa, string> = { ativa: t.ativar, parada: t.parar, arquivada: t.arquivar };
  const confirma: Partial<Record<SituacaoEmpresa, string>> = { parada: t.pararConfirma, arquivada: t.arquivarConfirma };
  return (
    <div className="mt-4 border-t border-stone-light pt-4">
      <p className="text-sm font-semibold text-navy">{t.situacao}: {d.enums.situacaoEmpresa[atual]}</p>
      <p className="text-sm text-stone">{t.situacaoAjuda}</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t.situacao}>
        {SITUACOES_EMPRESA.map((s) => s === atual ? (
          // A situação atual é um selo, não um botão desabilitado (que parecia apagado).
          <span key={s} aria-current="true"
                className="inline-flex min-h-touch items-center rounded-md bg-navy px-3 font-semibold text-white">
            {d.enums.situacaoEmpresa[s]}
          </span>
        ) : (
          <FormAcao key={s} action={mudarSituacaoEmpresa}
                    onSubmit={(ev) => { const c = confirma[s]; if (c && !window.confirm(fmtTexto(c, { nome }))) ev.preventDefault(); }}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="situacao" value={s} />
            <button type="submit" className={`px-3 ${s === "ativa" ? "btn-quieto" : "btn-perigo border border-loss"}`}>
              {rotulo[s]}
            </button>
          </FormAcao>
        ))}
      </div>
    </div>
  );
}

function FormNome({ id, nome, aoSalvar }: { id: string; nome: string; aoSalvar: () => void }) {
  const { d } = useI18n();
  const [estado, formAction] = useAcaoFormulario(async (s, fd) => {
    const r = await renomearEmpresa(s, fd);
    if (r.ok) aoSalvar();
    return r;
  });
  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="min-w-[14rem] flex-1">
        <label className="rotulo" htmlFor={`renomear-${id}`}>{d.master.nomeEmpresa}</label>
        <input id={`renomear-${id}`} name="nome" required maxLength={120} className="campo" defaultValue={nome} />
      </div>
      <SubmitButton className="btn-quieto">{d.comum.salvar}</SubmitButton>
      <div className="w-full"><Mensagem estado={estado} /></div>
    </form>
  );
}

function Selo({ texto }: { texto: string }) {
  return <span className="rounded bg-red-50 px-2 py-0.5 text-sm text-loss">{texto}</span>;
}

function Faturas({ empresa: e, faturas }: { empresa: EmpresaPlataforma; faturas: Fatura[] }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.master;
  const hoje = useHoje();

  return (
    <div className="mt-4">
      {faturas.length === 0 ? (
        <p className="text-stone">{t.semFaturas}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>{t.competencia}</th><th>{t.tipoFatura}</th><th>{t.vencimento}</th>
                <th className="num">{t.valorFatura}</th><th>{d.comum.acoes}</th>
              </tr>
            </thead>
            <tbody>
              {faturas.map((x) => {
                const pago = x.pago_em !== null;
                const atrasada = !pago && x.vencimento < hoje;
                return (
                  <tr key={x.id}>
                    <td className="whitespace-nowrap">{f.mesLongo(x.competencia)}</td>
                    <td>
                      {d.enums.tipoFatura[x.tipo]}
                      {x.descricao && <span className="block text-sm text-stone">{x.descricao}</span>}
                    </td>
                    <td className="whitespace-nowrap">
                      {f.data(x.vencimento)}
                      <span className={`block text-sm ${pago ? "text-gain" : atrasada ? "text-loss" : "text-stone"}`}>
                        {pago ? `${t.pago} ${f.data(x.pago_em!)}` : atrasada ? t.vencido : t.emAberto}
                      </span>
                    </td>
                    <td className="num font-semibold">{f.moeda(Number(x.valor), x.moeda)}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <FormAcao action={alternarPagamento}>
                          <input type="hidden" name="id" value={x.id} />
                          <input type="hidden" name="pago" value={pago ? "0" : "1"} />
                          <input type="hidden" name="hoje" value={hoje} />
                          <button type="submit" className="btn-quieto px-3">
                            {pago ? t.desfazerPago : t.marcarPago}
                          </button>
                        </FormAcao>
                        <FormAcao action={excluirFatura}
                              onSubmit={(ev) => {
                                const msg = fmtTexto(t.excluirFaturaConfirma, { valor: f.moeda(Number(x.valor), x.moeda) });
                                if (!window.confirm(msg)) ev.preventDefault();
                              }}>
                          <input type="hidden" name="id" value={x.id} />
                          <button type="submit" className="btn-perigo px-3">{d.comum.excluir}</button>
                        </FormAcao>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <FormFatura organizacaoId={e.id} moedaPadrao={e.moeda_cobranca} diaVencimento={e.dia_vencimento} />
    </div>
  );
}

function FormAdmin({ organizacaoId }: { organizacaoId: string }) {
  const { d } = useI18n();
  const [estado, formAction] = useAcaoFormulario(adicionarAdmin);
  return (
    <form key={estado.versao} action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="organizacao_id" value={organizacaoId} />
      <div className="min-w-[14rem] flex-1">
        <label className="rotulo" htmlFor={`admin-${organizacaoId}`}>{d.master.novoAdmin}</label>
        <input id={`admin-${organizacaoId}`} name="email" type="email" required maxLength={320} className="campo" />
      </div>
      <SubmitButton className="btn-quieto">{d.master.adicionar}</SubmitButton>
      <div className="w-full"><Mensagem estado={estado} /></div>
    </form>
  );
}

function FormContrato({ empresa: e, aoFechar }: { empresa: EmpresaPlataforma; aoFechar: () => void }) {
  const { d } = useI18n();
  const t = d.master;
  const [estado, formAction] = useAcaoFormulario(atualizarContrato);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-6">
      <input type="hidden" name="id" value={e.id} />
      <div className="sm:col-span-6">
        <label className="rotulo" htmlFor={`nome-${e.id}`}>{t.nomeEmpresa}</label>
        <input id={`nome-${e.id}`} name="nome" required maxLength={120} className="campo" defaultValue={e.nome} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`plano-${e.id}`}>{t.plano}</label>
        <select id={`plano-${e.id}`} name="plano" className="campo" defaultValue={e.plano}>
          {PLANOS_EMPRESA.map((p) => <option key={p} value={p}>{d.enums.planoEmpresa[p]}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`assentos-${e.id}`}>{t.assentos}</label>
        <input id={`assentos-${e.id}`} name="assentos" type="number" inputMode="numeric" min="1" max="10000"
               className="campo num" defaultValue={e.assentos ?? ""} />
        <p className="mt-1 text-sm text-stone">{t.assentosAjuda}</p>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`vigencia-${e.id}`}>{t.vigencia}</label>
        <input id={`vigencia-${e.id}`} name="vigencia_ate" type="date" className="campo"
               defaultValue={e.vigencia_ate ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`mensalidade-${e.id}`}>{t.mensalidade}</label>
        <input id={`mensalidade-${e.id}`} name="mensalidade" type="number" inputMode="decimal" min="0" step="0.01"
               className="campo num" defaultValue={Number(e.mensalidade)} />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor={`setup-${e.id}`}>{t.setup}</label>
        <input id={`setup-${e.id}`} name="setup" type="number" inputMode="decimal" min="0" step="0.01"
               className="campo num" defaultValue={Number(e.setup ?? 0)} />
      </div>
      <div className="sm:col-span-1">
        <label className="rotulo" htmlFor={`moedac-${e.id}`}>{t.moedaCobranca}</label>
        <select id={`moedac-${e.id}`} name="moeda_cobranca" className="campo" defaultValue={e.moeda_cobranca}>
          {MOEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="sm:col-span-1">
        <label className="rotulo" htmlFor={`dia-${e.id}`}>{t.diaVencimento}</label>
        <input id={`dia-${e.id}`} name="dia_vencimento" type="number" inputMode="numeric" min="1" max="28"
               className="campo num" defaultValue={e.dia_vencimento} />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton>{d.comum.salvar}</SubmitButton>
        <button type="button" className="btn-quieto" onClick={aoFechar}>{d.comum.cancelar}</button>
      </div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}

/**
 * Um administrador: editar troca o e-mail (entra o novo, sai o antigo — funciona
 * até com o único); remover só aparece quando há mais de um, porque o banco
 * recusa deixar a empresa sem ninguém.
 */
function LinhaAdmin({ organizacaoId, empresa, email, unico }:
  { organizacaoId: string; empresa: string; email: string; unico: boolean }) {
  const { d } = useI18n();
  const t = d.master;
  const [editando, setEditando] = useState(false);
  const [convite, setConvite] = useState(false);
  const [estTroca, acaoTroca] = useAcaoFormulario(trocarAdmin);
  const [estRem, acaoRem] = useAcaoFormulario(removerAdmin);
  return (
    <li className="rounded-md border border-stone-light p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="break-all">{email}</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-quieto px-3" aria-expanded={convite} onClick={() => setConvite(!convite)}>
            {t.reenviarAcesso}
          </button>
          <button type="button" className="btn-quieto px-3" onClick={() => setEditando(!editando)}>
            {editando ? d.comum.cancelar : d.comum.editar}
          </button>
          {!unico && (
            <form action={acaoRem}
                  onSubmit={(ev) => { if (!window.confirm(fmtTexto(t.removerConfirma, { email }))) ev.preventDefault(); }}>
              <input type="hidden" name="organizacao_id" value={organizacaoId} />
              <input type="hidden" name="email" value={email} />
              <button type="submit" className="btn-perigo px-3">{d.comum.remover}</button>
            </form>
          )}
        </div>
      </div>
      {editando && (
        <form key={estTroca.versao} action={acaoTroca} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="organizacao_id" value={organizacaoId} />
          <input type="hidden" name="email_antigo" value={email} />
          <div className="min-w-[14rem] flex-1">
            <label className="rotulo" htmlFor={`troca-${organizacaoId}-${email}`}>{t.trocarEmail}</label>
            <input id={`troca-${organizacaoId}-${email}`} name="email" type="email" required maxLength={320}
                   className="campo" defaultValue={email} />
          </div>
          <SubmitButton className="btn-quieto">{d.comum.salvar}</SubmitButton>
        </form>
      )}
      {convite && <ConviteAcesso empresa={empresa} emails={[email]} />}
      <Mensagem estado={estTroca} />
      <Mensagem estado={estRem} />
    </li>
  );
}

/** Só empresa vazia se exclui (excluir_empresa, 0028); o banco confere, a tela explica. */
function ExcluirEmpresa({ id, nome }: { id: string; nome: string }) {
  const { d } = useI18n();
  const t = d.master;
  const [digitado, setDigitado] = useState("");
  const [estado, formAction] = useAcaoFormulario(excluirEmpresa);
  return (
    <section className="mt-6 border-t border-stone-light pt-4">
      <h4 className="font-semibold text-loss">{t.excluirEmpresa}</h4>
      <p className="mt-1 text-stone">{t.excluirEmpresaTexto}</p>
      <form action={formAction} className="mt-3 grid gap-3 sm:max-w-md"
            onSubmit={(ev) => { if (!window.confirm(fmtTexto(t.excluirEmpresaConfirma, { nome }))) ev.preventDefault(); }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="nome" value={nome} />
        <label className="rotulo" htmlFor={`excl-${id}`}>{t.excluirEmpresaDigite}: <strong className="text-navy">{nome}</strong></label>
        <input id={`excl-${id}`} name="confirmacao" className="campo" autoComplete="off"
               value={digitado} onChange={(ev) => setDigitado(ev.target.value)} />
        <button type="submit" disabled={!mesmoNome(digitado, nome)} className="btn-perigo border border-loss">{t.excluirEmpresa}</button>
        <Mensagem estado={estado} />
      </form>
    </section>
  );
}
