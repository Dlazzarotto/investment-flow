import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dicionario } from "@/lib/i18n/dicionarios/pt";
import { traduzirErroBanco } from "@/app/actions/erros";

export { PREFIXO_MERCADO } from "./adocao-constantes";

/**
 * Adota uma commodity do catálogo do mercado (0030): cria a da empresa com o nome
 * no idioma de quem escolheu, o grupo, a unidade e a referência de preço do catálogo.
 * Se a empresa já tem uma com o mesmo código ou nome, devolve essa (e a liga ao
 * catálogo) em vez de duplicar. Usada pelo cadastro, pelo contrato, pelo painel e
 * pela pesquisa de mercado — todo seletor de commodity oferece o catálogo.
 * Fora de "use server" de propósito: não é ação chamável pelo navegador.
 */
export async function adotarDoMercado(supabase: SupabaseClient, organizacaoId: string, codigo: string, d: Dicionario):
  Promise<{ id: string; nome: string } | { erro: string }> {
  if (!/^[a-z0-9_]{2,40}$/.test(codigo)) return { erro: d.validacao.dadosInvalidos };
  const { data: item, error: e1 } = await supabase.from("commodities_padrao").select("*").eq("codigo", codigo).maybeSingle();
  if (e1 || !item) return { erro: d.banco.naoEncontrado };
  const { data: grupo } = await supabase.from("commodity_grupos").select("id")
    .eq("codigo", item.grupo_codigo).is("organizacao_id", null).maybeSingle();
  const nome = d.enums.commodityPadrao[codigo as keyof typeof d.enums.commodityPadrao] ?? codigo;

  const { data, error } = await supabase.from("commodities").insert({
    organizacao_id: organizacaoId, nome, grupo_id: grupo?.id ?? null, padrao_codigo: codigo,
    unidade_padrao: item.unidade, bolsa: item.referencia && item.referencia !== "—" ? item.referencia : null, ativo: true,
  }).select("id").single();
  if (error?.code === "23505") {
    // Já adotada, ou já existe com o mesmo nome: devolve a que existe (e liga ao catálogo, se ainda não estava).
    const porCodigo = await supabase.from("commodities").select("id, padrao_codigo")
      .eq("organizacao_id", organizacaoId).eq("padrao_codigo", codigo).maybeSingle();
    // ilike sem curinga = igual, sem diferenciar maiúsculas; escapa % e _ do nome.
    const porNome = porCodigo.data ? null : await supabase.from("commodities").select("id, padrao_codigo")
      .eq("organizacao_id", organizacaoId).ilike("nome", nome.replace(/[\\%_]/g, (c) => `\\${c}`)).limit(1).maybeSingle();
    const existente = porCodigo.data ?? porNome?.data ?? null;
    if (!existente) return { erro: traduzirErroBanco(error, "commodity", d) };
    if (!existente.padrao_codigo) {
      await supabase.from("commodities").update({ padrao_codigo: codigo, grupo_id: grupo?.id ?? null }).eq("id", existente.id);
    }
    revalidatePath("/commodities");
    return { id: existente.id as string, nome };
  }
  if (error) return { erro: traduzirErroBanco(error, "commodity", d) };
  revalidatePath("/commodities");
  revalidatePath("/contratos", "layout");
  return { id: data.id as string, nome };
}
