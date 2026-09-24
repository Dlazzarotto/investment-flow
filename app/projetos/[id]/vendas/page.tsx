import { redirect } from "next/navigation";

/**
 * A aba Vendas da 1ª versão saiu do projeto: vender é da empresa (menu Vendas), e
 * as vendas antigas viraram contratos concluídos por conta do projeto (0022).
 */
export default function VendasPage({ params }: { params: { id: string } }) {
  redirect(`/projetos/${params.id}`);
}
