import type { ActionState } from "@/lib/types";

export function Mensagem({ estado }: { estado: ActionState }) {
  if (estado.erro) {
    return <p role="alert" className="mt-3 rounded-md border-l-4 border-loss bg-red-50 px-4 py-3 text-loss">{estado.erro}</p>;
  }
  if (estado.sucesso) {
    return <p role="status" className="mt-3 rounded-md border-l-4 border-gain bg-green-50 px-4 py-3 text-gain">{estado.sucesso}</p>;
  }
  return null;
}
