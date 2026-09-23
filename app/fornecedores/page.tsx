import { Shell } from "@/components/Shell";
import { ListaFornecedores } from "@/components/cadastros/ListaFornecedores";
import { Vazio } from "@/components/ui/Vazio";
import { ehMaster, listarCarteira, listarFornecedores, listarProjetos, minhaOrganizacao } from "@/lib/consultas";
import { obterD } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/** Cadastro de fornecedores: é ele que tira a descrição livre do lançamento. */
export default async function FornecedoresPage() {
  const { d } = obterD();
  const [projetos, carteira, master, org] = await Promise.all([
    listarProjetos(), listarCarteira(), ehMaster(), minhaOrganizacao(),
  ]);
  const fornecedores = await listarFornecedores(org?.organizacao.id);
  const t = d.cadastros;

  return (
    <Shell projetos={projetos} temCarteira={carteira.length > 0} ehMaster={master} empresa={org?.organizacao.nome}>
      <h1 className="text-2xl">{t.fornecedoresTitulo}</h1>
      <p className="mt-1 text-stone">{t.fornecedoresSubtitulo}</p>
      <div className="mt-6">
        {org ? (
          <ListaFornecedores fornecedores={fornecedores} organizacaoId={org.organizacao.id} />
        ) : (
          <Vazio titulo={t.semEmpresa} texto={t.semEmpresaTexto} />
        )}
      </div>
    </Shell>
  );
}
