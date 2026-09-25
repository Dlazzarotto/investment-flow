import Link from "next/link";
import { Vazio } from "@/components/ui/Vazio";
import { listarCarteira } from "@/lib/consultas";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";

export default async function CarteiraPage() {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const carteira = await listarCarteira();
  const t = d.carteira;
  return (
    <>
      <h1 className="text-2xl">{t.titulo}</h1>
      <p className="mt-1 text-stone">{t.subtitulo}</p>
      <section className="secao">
        {carteira.length === 0 ? <Vazio titulo={t.vazioTitulo} texto={t.vazioTexto} /> : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {carteira.map((c) => (
              <li key={c.projeto_id}>
                <Link href={`/carteira/${c.projeto_id}`} className="block rounded-md border border-stone-light bg-white px-5 py-4 hover:border-navy">
                  <p className="text-lg font-semibold text-navy">{c.nome}</p>
                  <p className="text-stone">{c.moeda} · {fmtTexto(t.projetoDesde, { data: f.data(c.data_inicio) })}</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div><p className="text-sm text-stone">{t.minhaParticipacao}</p><p className="num font-semibold">{f.numero(c.minha_pct, 2)} %</p></div>
                    <div><p className="text-sm text-stone">{t.meusAportes}</p><p className="num font-semibold">{f.moeda(c.meus_aportes, c.moeda)}</p></div>
                    <div><p className="text-sm text-stone">{t.saldoProjeto}</p><p className={`num font-semibold ${c.saldo < 0 ? "text-loss" : "text-gain"}`}>{f.moeda(c.saldo, c.moeda)}</p></div>
                    <div><p className="text-sm text-stone">{t.saldoAtribuivel}</p><p className={`num font-semibold ${c.saldo_atribuivel < 0 ? "text-loss" : "text-gain"}`}>{f.moeda(c.saldo_atribuivel, c.moeda)}</p></div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
