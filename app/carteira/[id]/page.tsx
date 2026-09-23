import Link from "next/link";
import { notFound } from "next/navigation";
import { Kpi } from "@/components/Kpi";
import { Vazio } from "@/components/ui/Vazio";
import { listarAportes, listarCarteira, listarVendas } from "@/lib/consultas";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";

/** Detalhe de um projeto na visão do investidor: só leitura, só o que é dele + totais do projeto. */
export default async function CarteiraProjetoPage({ params }: { params: { id: string } }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const carteira = await listarCarteira();
  const c = carteira.find((x) => x.projeto_id === params.id);
  if (!c) notFound();
  const [aportes, vendas] = await Promise.all([listarAportes(c.projeto_id), listarVendas(c.projeto_id)]);
  const t = d.carteira;
  const m = c.moeda;

  return (
    <>
      <Link href="/carteira" className="text-navy underline">{t.voltar}</Link>
      <h1 className="mt-2 text-2xl">{c.nome}</h1>
      <p className="mt-1 text-stone">{d.enums.tipoParceria[c.tipo_parceria]} · {c.participante_nome} · {fmtTexto(t.projetoDesde, { data: f.data(c.data_inicio) })}</p>
      <p className="mt-3 rounded-md border-l-4 border-navy bg-navy-soft px-4 py-3">{t.somenteLeitura}</p>

      <section className="mt-8 rounded-md bg-navy px-5 py-6 text-white sm:px-8">
        <p className="text-sm text-white/75">{t.saldoAtribuivel}</p>
        <p className={`num mt-1 text-3xl font-semibold leading-none ${c.saldo_atribuivel < 0 ? "text-orange" : ""}`}>{f.moeda(c.saldo_atribuivel, m)}</p>
        <p className="mt-3 text-white/85">{t.minhaParticipacao}: <span className="num font-semibold text-white">{f.numero(c.minha_pct, 2)} %</span> · {t.meusAportes}: <span className="num font-semibold text-white">{f.moeda(c.meus_aportes, m)}</span></p>
      </section>

      <section className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo={t.investimentoTotal} valor={f.moeda(c.investimento_total, m)} />
        <Kpi rotulo={t.receitaTotal} valor={f.moeda(c.receita_total, m)} />
        <Kpi rotulo={t.saidaTotal} valor={f.moeda(c.saida_total, m)} />
        <Kpi rotulo={t.saldoProjeto} valor={f.moeda(c.saldo, m)} tom={c.saldo < 0 ? "loss" : c.saldo > 0 ? "gain" : "neutro"} />
      </section>

      <section className="secao">
        <h2>{t.comoEntrei}</h2>
        {aportes.length === 0 ? <Vazio titulo={d.aportes.vazioTitulo} texto={d.aportes.vazioTexto} /> : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead><tr><th>{d.comum.data}</th><th>{d.aportes.tipo}</th><th>{d.aportes.descricao}</th><th className="num">{d.exportacao.valor}</th></tr></thead>
              <tbody>
                {aportes.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">{f.data(a.data)}</td><td>{d.enums.tipoAporte[a.tipo]}</td>
                    <td>{a.descricao}{a.observacoes && <span className="block text-stone">{a.observacoes}</span>}</td>
                    <td className="num font-semibold">{f.moeda(Number(a.valor), m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="secao">
        <h2>{t.vendas}</h2>
        {vendas.length === 0 ? <Vazio titulo={d.vendas.vazioTitulo} texto={d.vendas.vazioTexto} /> : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead><tr><th>{d.comum.data}</th><th>{d.comum.categoria}</th><th className="num">{d.vendas.volume}</th><th>{d.comum.unidade}</th><th className="num">{d.vendas.precoUnit}</th><th className="num">{d.vendas.receita}</th></tr></thead>
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap">{f.data(v.data)}</td><td>{d.enums.categoriaReceita[v.categoria]}</td>
                    <td className="num">{f.numero(Number(v.volume), 2)}</td><td>{v.unidade}</td>
                    <td className="num">{f.moeda(Number(v.preco_unitario), m)}</td><td className="num font-semibold">{f.moeda(Number(v.receita_total), m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
