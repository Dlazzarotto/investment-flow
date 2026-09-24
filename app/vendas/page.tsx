import { PaginaContratos } from "@/components/contratos/PaginaContratos";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: { status?: string } }) {
  return <PaginaContratos direcao="venda" statusParam={searchParams.status} />;
}
