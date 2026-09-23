import { Shell } from "@/components/Shell";
import { ListaCommodities } from "@/components/cadastros/ListaCommodities";
import { Vazio } from "@/components/ui/Vazio";
import {
  ehMaster, listarCarteira, listarCommodities, listarParametros, listarProjetos, minhaOrganizacao,
} from "@/lib/consultas";
import { obterD } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/** Catálogo do que a empresa negocia, com os parâmetros que definem a qualidade. */
export default async function CommoditiesPage() {
  const { d } = obterD();
  const [projetos, carteira, master, org] = await Promise.all([
    listarProjetos(), listarCarteira(), ehMaster(), minhaOrganizacao(),
  ]);
  const commodities = await listarCommodities(org?.organizacao.id);
  const parametros = await listarParametros(commodities.map((c) => c.id));
  const t = d.cadastros;

  return (
    <Shell projetos={projetos} temCarteira={carteira.length > 0} ehMaster={master} empresa={org?.organizacao.nome}>
      <h1 className="text-2xl">{t.commoditiesTitulo}</h1>
      <p className="mt-1 text-stone">{t.commoditiesSubtitulo}</p>
      <div className="mt-6">
        {org ? (
          <ListaCommodities commodities={commodities} parametros={parametros} organizacaoId={org.organizacao.id} />
        ) : (
          <Vazio titulo={t.semEmpresa} texto={t.semEmpresaTexto} />
        )}
      </div>
    </Shell>
  );
}
