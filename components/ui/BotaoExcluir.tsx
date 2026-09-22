"use client";
import { useI18n } from "@/lib/i18n/client";

/**
 * Botão de exclusão com confirmação; envia o formulário pai (server action).
 * Com `pedirPin`, pergunta o PIN do projeto e manda junto — é o caminho do papel
 * Escritório, que só altera e exclui com autorização.
 */
export function BotaoExcluir({ action, id, projetoId, confirmacao, rotulo, pedirPin = false }:
  { action: (fd: FormData) => Promise<void>; id: string; projetoId: string; confirmacao: string;
    rotulo: string; pedirPin?: boolean }) {
  const { d } = useI18n();
  return (
    <form action={action} onSubmit={(e) => {
      if (!window.confirm(confirmacao)) { e.preventDefault(); return; }
      if (!pedirPin) return;
      const pin = window.prompt(d.acesso.pinObrigatorio);
      if (!pin) { e.preventDefault(); return; }
      const campo = e.currentTarget.elements.namedItem("pin");
      if (campo instanceof HTMLInputElement) campo.value = pin;
    }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="projeto_id" value={projetoId} />
      {pedirPin && <input type="hidden" name="pin" defaultValue="" />}
      <button type="submit" className="btn-perigo px-3" aria-label={rotulo}>{rotulo}</button>
    </form>
  );
}
