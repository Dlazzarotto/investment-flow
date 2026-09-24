import { redirect } from "next/navigation";

/** A lista de contratos mora em /vendas e /compras (menu principal); este endereço antigo leva para lá. */
export default function ContratosPage({ searchParams }: { searchParams: { status?: string; direcao?: string } }) {
  const base = searchParams.direcao === "compra" ? "/compras" : "/vendas";
  redirect(searchParams.status ? `${base}?status=${encodeURIComponent(searchParams.status)}` : base);
}
