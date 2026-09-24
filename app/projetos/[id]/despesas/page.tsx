import { FormDespesa } from "@/components/forms/FormDespesa";
import { FormInvestimento } from "@/components/forms/FormInvestimento";
import { TabelaDespesas } from "@/components/tabelas/TabelaDespesas";
import { TabelaInvestimentos, type LinhaInvestimento } from "@/components/tabelas/TabelaInvestimentos";
import { listarDespesas, listarInvestimentos, mapaUltimasEstimativas, obterPapel, obterProjeto } from "@/lib/consultas";
import { permissoes } from "@/lib/permissoes";
import { despesasPorCategoria, normalizarItem } from "@/lib/calculos";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import type { CategoriaDespesa } from "@/lib/types";

/**
 * Custos do projeto: o que o PROJETO paga. Despesas (custeio) e investimentos
 * (capex: máquinas, infraestrutura) na mesma página, separados por tipo — decisão
 * do usuário. Capex continua visível só para dono e admin (0006).
 */
export default async function CustosPage({ params }: { params: { id: string } }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const projeto = await obterProjeto(params.id);
  const papel = await obterPapel(projeto.id);
  const pode = permissoes(papel);
  const [despesas, investimentos, estimativas] = await Promise.all([
    listarDespesas(projeto.id),
    pode.verInvestimentos ? listarInvestimentos(projeto.id) : Promise.resolve([]),
    pode.verInvestimentos ? mapaUltimasEstimativas(projeto.id) : Promise.resolve(new Map()),
  ]);
  const totalDespesas = despesas.reduce((s, x) => s + Number(x.valor), 0);
  const totalCapex = investimentos.reduce((s, i) => s + Number(i.valor_total), 0);
  const porCategoria = despesasPorCategoria(despesas);
  const iaDisponivel = Boolean(process.env.ANTHROPIC_API_KEY);
  const m = projeto.moeda;
  const t = d.despesas;
  const ti = d.investimentos;
  // O Map de estimativas não atravessa a fronteira servidor → cliente: vira campo da linha.
  const linhas: LinhaInvestimento[] = investimentos.map((investimento) => {
    const e = estimativas.get(normalizarItem(investimento.item));
    return {
      investimento,
      media: e ? { valor_min: Number(e.valor_min), valor_medio: Number(e.valor_medio),
                   valor_max: Number(e.valor_max), unidade_ref: e.unidade_ref } : null,
    };
  });

  return (
    <>
      <h1 className="text-2xl">{d.custos.titulo}</h1>
      <p className="mt-1 text-stone">{fmtTexto(d.custos.subtitulo, { nome: projeto.nome })}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-stone-light bg-white p-4">
          <p className="text-sm text-stone">{d.custos.despesas}</p>
          <p className="num mt-1 text-lg font-semibold text-navy">{f.moeda(totalDespesas, m)}</p>
        </div>
        {pode.verInvestimentos && (
          <div className="rounded-md border border-stone-light bg-white p-4">
            <p className="text-sm text-stone">{d.custos.capex}</p>
            <p className="num mt-1 text-lg font-semibold text-navy">{f.moeda(totalCapex, m)}</p>
          </div>
        )}
      </div>

      <section className="secao" id="despesas">
        <h2>{d.custos.despesas}</h2>
        {pode.lancar ? <FormDespesa projetoId={projeto.id} moeda={m} />
          : <p className="rounded-md border-l-4 border-navy bg-navy-soft px-4 py-3">{d.membros.somenteLeitura}</p>}
        <div className="mt-6">
          <TabelaDespesas despesas={despesas} projetoId={projeto.id} moeda={m} editavel={pode.lancar} pedirPin={pode.alterarComPin} />
        </div>
        {porCategoria.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <h3 className="mb-2 text-lg text-navy">{t.porCategoria}</h3>
            <table className="tabela">
              <thead><tr><th>{d.comum.categoria}</th><th className="num">{d.comum.total}</th><th className="num">%</th></tr></thead>
              <tbody>
                {porCategoria.map((c) => (
                  <tr key={c.categoria}>
                    <td className="font-medium">{d.enums.categoriaDespesa[c.categoria as CategoriaDespesa]}</td>
                    <td className="num">{f.moeda(c.valor, m)}</td>
                    <td className="num">{f.pct(totalDespesas > 0 ? c.valor / totalDespesas : null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pode.verInvestimentos && (
        <section className="secao" id="capex">
          <h2>{d.custos.capex}</h2>
          {!iaDisponivel && <p className="mb-4 text-stone">{ti.iaDesativada}</p>}
          <FormInvestimento projetoId={projeto.id} moeda={m} iaDisponivel={iaDisponivel} />
          <div className="mt-6">
            <TabelaInvestimentos linhas={linhas} projetoId={projeto.id} moeda={m} editavel />
          </div>
        </section>
      )}
    </>
  );
}
