import { Shell } from "@/components/Shell";
import { ListaClientes } from "@/components/cadastros/ListaClientes";
import { Vazio } from "@/components/ui/Vazio";
import { ehMaster, listarCarteira, listarClientes, listarDocumentosClientes, listarProjetos, minhaOrganizacao } from "@/lib/consultas";
import { obterD } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/** Cadastro de clientes da empresa: comprador, vendedor, investidor, monetizador. */
export default async function ClientesPage() {
  const { d } = obterD();
  const [projetos, carteira, master, org] = await Promise.all([
    listarProjetos(), listarCarteira(), ehMaster(), minhaOrganizacao(),
  ]);
  const [clientes, documentos] = await Promise.all([
    listarClientes(org?.organizacao.id), listarDocumentosClientes(org?.organizacao.id),
  ]);
  const t = d.cadastros;

  return (
    <Shell projetos={projetos} temCarteira={carteira.length > 0} ehMaster={master} empresa={org?.organizacao.nome}>
      <h1 className="text-2xl">{t.clientesTitulo}</h1>
      <p className="mt-1 text-stone">{t.clientesSubtitulo}</p>
      <div className="mt-6">
        {org ? (
          <ListaClientes clientes={clientes} organizacaoId={org.organizacao.id} documentos={documentos} />
        ) : (
          <Vazio titulo={t.semEmpresa} texto={t.semEmpresaTexto} />
        )}
      </div>
    </Shell>
  );
}
