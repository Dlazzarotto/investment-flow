import { Shell } from "@/components/Shell";
import { ListaLocais } from "@/components/cadastros/ListaLocais";
import { Vazio } from "@/components/ui/Vazio";
import { ehMaster, listarCarteira, listarLocais, listarProjetos, minhaOrganizacao } from "@/lib/consultas";
import { obterD } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/** Locais da operação (0029): escolhidos no contrato como origem, carga, transbordo, descarga e destino final. */
export default async function LocaisPage() {
  const { d } = obterD();
  const [projetos, carteira, master, org] = await Promise.all([
    listarProjetos(), listarCarteira(), ehMaster(), minhaOrganizacao(),
  ]);
  const locais = await listarLocais(org?.organizacao.id);
  const t = d.cadastros;

  return (
    <Shell projetos={projetos} temCarteira={carteira.length > 0} ehMaster={master} empresa={org?.organizacao.nome}>
      <h1 className="text-2xl">{t.locaisTitulo}</h1>
      <p className="mt-1 text-stone">{t.locaisSubtitulo}</p>
      <div className="mt-6">
        {org ? (
          <ListaLocais locais={locais} organizacaoId={org.organizacao.id} />
        ) : (
          <Vazio titulo={t.semEmpresa} texto={t.semEmpresaTexto} />
        )}
      </div>
    </Shell>
  );
}
