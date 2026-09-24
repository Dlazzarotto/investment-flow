import { redirect } from "next/navigation";

/** Capex agora faz parte de "Custos do projeto" (decisão do usuário). */
export default function InvestimentosPage({ params }: { params: { id: string } }) {
  redirect(`/projetos/${params.id}/despesas#capex`);
}
