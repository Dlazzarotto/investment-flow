import type { StatusContrato } from "@/lib/types";

/** Cor do selo por status: o que ainda vai movimentar carga fica em destaque. */
const COR: Record<StatusContrato, string> = {
  rascunho: "bg-stone-light text-stone", assinado: "bg-navy-soft text-navy", em_execucao: "bg-orange-soft text-orange-deep",
  concluido: "bg-green-50 text-gain", cancelado: "bg-red-50 text-loss",
};

export function SeloStatus({ status, rotulo }: { status: StatusContrato; rotulo: string }) {
  return <span className={`rounded px-2 py-0.5 text-sm font-semibold ${COR[status]}`}>{rotulo}</span>;
}
