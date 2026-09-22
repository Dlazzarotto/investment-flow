"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";

export function ConfirmarExclusaoProjeto({ action, projetoId, nome }:
  { action: (fd: FormData) => Promise<void>; projetoId: string; nome: string }) {
  const { d } = useI18n();
  const [digitado, setDigitado] = useState("");
  const liberado = digitado.trim() === nome.trim();
  return (
    <form action={action} className="grid gap-3 sm:max-w-md"
          onSubmit={(e) => { if (!window.confirm(fmtTexto(d.parceria.excluirConfirma, { nome }))) e.preventDefault(); }}>
      <input type="hidden" name="id" value={projetoId} />
      <label className="rotulo" htmlFor="confirmar_nome">{d.parceria.excluirDigite}</label>
      <input id="confirmar_nome" className="campo" value={digitado} onChange={(e) => setDigitado(e.target.value)} autoComplete="off" />
      <button type="submit" disabled={!liberado} className="btn-perigo border border-loss">{d.parceria.excluirBotao}</button>
    </form>
  );
}
