"use client";
import { useState } from "react";
import { adicionarAdmin, atualizarContrato, removerAdmin } from "@/app/actions/master";
import { Mensagem } from "@/components/ui/Mensagem";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { PLANOS_EMPRESA, type EmpresaPlataforma } from "@/lib/types";

/** Uma empresa: contrato, uso e quem administra. */
export function CartaoEmpresa({ empresa: e }: { empresa: EmpresaPlataforma }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.master;
  const [aberto, setAberto] = useState(false);

  const vencida = !e.em_dia && e.ativa;
  const uso = e.assentos === null ? `${e.assentos_usados} / ${t.semTeto}` : `${e.assentos_usados} / ${e.assentos}`;
  const cheio = e.assentos !== null && e.assentos_usados >= e.assentos;

  return (
    <article className="rounded-md border border-stone-light bg-white p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg text-navy">{e.nome}</h3>
          <p className="text-stone">
            {d.enums.planoEmpresa[e.plano]}
            {e.vigencia_ate && ` · ${t.vigencia} ${f.data(e.vigencia_ate)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!e.ativa && <Selo texto={t.suspensa} tom="loss" />}
          {vencida && <Selo texto={t.vencida} tom="loss" />}
          <p className="text-stone">
            {t.uso}: <span className={`num font-semibold ${cheio ? "text-loss" : "text-navy"}`}>{uso}</span>
          </p>
          <p className="text-stone">{t.projetos}: <span className="num font-semibold text-navy">{e.projetos}</span></p>
        </div>
      </header>

      <div className="mt-4 border-t border-stone-light pt-4">
        <p className="text-sm font-semibold text-navy">{t.admins}</p>
        <ul className="mt-2 grid gap-2">
          {e.admins.map((email) => (
            <li key={email} className="flex flex-wrap items-center justify-between gap-2">
              <span className="break-all">{email}</span>
              <form action={removerAdmin}
                    onSubmit={(ev) => { if (!window.confirm(fmtTexto(t.removerConfirma, { email }))) ev.preventDefault(); }}>
                <input type="hidden" name="organizacao_id" value={e.id} />
                <input type="hidden" name="email" value={email} />
                <button type="submit" className="btn-perigo px-3">{d.comum.remover}</button>
              </form>
            </li>
          ))}
        </ul>
        <FormAdmin organizacaoId={e.id} />
      </div>

      <div className="mt-4 border-t border-stone-light pt-4">
        {aberto ? (
          <FormContrato empresa={e} aoFechar={() => setAberto(false)} />
        ) : (
          <button type="button" className="btn-quieto" onClick={() => setAberto(true)}>{t.contrato}</button>
        )}
      </div>
    </article>
  );
}

function Selo({ texto, tom }: { texto: string; tom: "loss" | "gain" }) {
  return (
    <span className={`rounded px-2 py-0.5 text-sm ${tom === "loss" ? "bg-red-50 text-loss" : "bg-green-50 text-gain"}`}>
      {texto}
    </span>
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
      <label className="flex min-h-touch items-center gap-3 sm:col-span-6">
        <input type="checkbox" name="ativa" defaultChecked={e.ativa} className="h-6 w-6 accent-navy" />
        <span>{t.ativa}</span>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton>{d.comum.salvar}</SubmitButton>
        <button type="button" className="btn-quieto" onClick={aoFechar}>{d.comum.cancelar}</button>
      </div>
      <div className="sm:col-span-6"><Mensagem estado={estado} /></div>
    </form>
  );
}
