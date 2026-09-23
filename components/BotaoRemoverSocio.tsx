"use client";
import { removerSocio } from "@/app/actions/organizacao";

export function BotaoRemoverSocio({ id, confirmacao, rotulo }: { id: string; confirmacao: string; rotulo: string }) {
  return (
    <form action={removerSocio} onSubmit={(e) => { if (!window.confirm(confirmacao)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn-perigo px-3">{rotulo}</button>
    </form>
  );
}
