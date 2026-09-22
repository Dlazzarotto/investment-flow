"use client";
import { useFormState } from "react-dom";
import type { ActionState } from "@/lib/types";

export type EstadoFormulario = ActionState & { versao: number };

/**
 * useFormState que conta os envios bem-sucedidos. Use `estado.versao` como `key` do
 * componente de campos para limpar o formulário (inclusive estado local) após salvar.
 */
export function useAcaoFormulario(acao: (s: ActionState, fd: FormData) => Promise<ActionState>) {
  return useFormState<EstadoFormulario, FormData>(
    async (prev, fd) => {
      const r = await acao(prev, fd);
      return { ...r, versao: r.ok ? prev.versao + 1 : prev.versao };
    },
    { ok: false, versao: 0 },
  );
}
