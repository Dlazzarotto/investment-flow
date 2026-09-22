"use client";

/** Botão de exclusão com confirmação; envia o formulário pai (server action). */
export function BotaoExcluir({ action, id, projetoId, confirmacao, rotulo }:
  { action: (fd: FormData) => Promise<void>; id: string; projetoId: string; confirmacao: string; rotulo: string }) {
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm(confirmacao)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="projeto_id" value={projetoId} />
      <button type="submit" className="btn-perigo px-3" aria-label={rotulo}>{rotulo}</button>
    </form>
  );
}
