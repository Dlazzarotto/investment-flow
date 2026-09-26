"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { mesmoNome } from "@/lib/texto";
import { FormAcao } from "@/components/ui/FormAcao";
import type { ActionState } from "@/lib/types";

export function ConfirmarExclusaoProjeto({ action, projetoId, nome }:
  { action: (s: ActionState, fd: FormData) => Promise<ActionState>; projetoId: string; nome: string }) {
  const { d } = useI18n();
  const [digitado, setDigitado] = useState("");
  const liberado = mesmoNome(digitado, nome);
  return (
    <FormAcao action={action} className="grid gap-3 sm:max-w-md"
          onSubmit={(e) => { if (!window.confirm(fmtTexto(d.parceria.excluirConfirma, { nome }))) e.preventDefault(); }}>
      <input type="hidden" name="id" value={projetoId} />
      <label className="rotulo" htmlFor="confirmar_nome">{d.parceria.excluirDigite}: <strong className="text-navy">{nome}</strong></label>
      <input id="confirmar_nome" className="campo" value={digitado} onChange={(e) => setDigitado(e.target.value)} autoComplete="off" />
      <button type="submit" disabled={!liberado} className="btn-perigo border border-loss">{d.parceria.excluirBotao}</button>
    </FormAcao>
  );
}
