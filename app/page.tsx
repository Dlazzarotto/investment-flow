import { redirect } from "next/navigation";
// O ADM entra no painel da empresa, nao na lista de projetos: o projeto e um
// campo do lancamento, nao o lugar onde ele trabalha.
export default function Home() { redirect("/painel"); }
