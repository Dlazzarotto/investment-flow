"use client";
import type { FormEventHandler, ReactNode } from "react";
import { useAcaoFormulario } from "./useAcaoFormulario";
import type { ActionState } from "@/lib/types";

/**
 * Formulário de uma ação curta (excluir, mudar status, revogar) que mostra o erro
 * ali mesmo. Server action que LANÇA erro derruba a página em "Algo deu errado" —
 * e em produção o Next ainda troca a mensagem traduzida por um texto genérico.
 * Por isso essas ações devolvem ActionState, e este formulário o exibe.
 */
export function FormAcao({ action, children, className, onSubmit }: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>; children: ReactNode;
  className?: string; onSubmit?: FormEventHandler<HTMLFormElement>;
}) {
  const [estado, formAction] = useAcaoFormulario(action);
  return (
    <>
      <form action={formAction} className={className} onSubmit={onSubmit}>{children}</form>
      {!estado.ok && estado.erro && <p role="alert" className="mt-1 max-w-sm text-sm text-loss">{estado.erro}</p>}
    </>
  );
}
