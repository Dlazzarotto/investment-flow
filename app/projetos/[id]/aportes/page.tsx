import { FormAporte } from "@/components/forms/FormAporte";
import { BotaoExcluir } from "@/components/ui/BotaoExcluir";
import { Vazio } from "@/components/ui/Vazio";
import { excluirAporte } from "@/app/actions/aportes";
import { listarAportes, listarParticipantes, obterPapel, obterProjeto } from "@/lib/consultas";
import { permissoes } from "@/lib/permissoes";
import { resumoAportes } from "@/lib/calculos";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";

export default async function AportesPage({ params }: { params: { id: string } }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const projeto = await obterProjeto(params.id);
  const papel = await obterPapel(projeto.id);
  const pode = permissoes(papel);
  const [participantes, aportes] = await Promise.all([listarParticipantes(projeto.id), listarAportes(projeto.id)]);
  const resumo = resumoAportes(participantes, aportes);
  const nomePorId = new Map(participantes.map((p) => [p.id, p.nome]));
  const t = d.aportes;
  const m = projeto.moeda;

  return (
    <>
      <h1 className="text-2xl">{t.titulo}</h1>
      <p className="mt-1 text-stone">{fmtTexto(t.subtitulo, { nome: projeto.nome })}</p>

      {pode.administrar && (
        <section className="secao max-w-4xl">
          <h2>{t.novo}</h2>
          {participantes.length === 0
            ? <p className="rounded-md border-l-4 border-orange bg-orange-soft px-4 py-3">{t.semParticipantes}</p>
            : <FormAporte projetoId={projeto.id} moeda={m} participantes={participantes} />}
        </section>
      )}

      <section className="secao">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="mb-0">{t.porParticipante}</h2>
          <p className="text-stone">{t.totalAportado}: <span className="num font-semibold text-navy">{f.moeda(resumo.total, m)}</span></p>
        </div>
        {participantes.length === 0 ? <Vazio titulo={t.vazioTitulo} texto={t.semParticipantes} /> : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead><tr>
                <th>{t.participante}</th><th className="num">{t.aportado}</th><th className="num">{t.pactuada}</th>
                <th className="num">{t.implicita}</th><th className="num">{t.diferenca}</th>
              </tr></thead>
              <tbody>
                {resumo.linhas.map((l) => {
                  const cor = l.diferenca === null ? "text-stone" : Math.abs(l.diferenca) >= 5 ? "text-loss" : "text-gain";
                  return (
                    <tr key={l.participante_id}>
                      <td className="font-medium">{l.nome}</td>
                      <td className="num">{f.moeda(l.aportado, m)}</td>
                      <td className="num">{f.numero(l.pactuada, 2)} %</td>
                      <td className="num">{l.implicita === null ? "—" : `${f.numero(l.implicita, 2)} %`}</td>
                      <td className={`num ${cor}`}>{l.diferenca === null ? "—" : `${l.diferenca > 0 ? "+" : ""}${f.numero(l.diferenca, 2)} pp`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-stone">{t.legendaImplicita}</p>
          </div>
        )}
      </section>

      <section className="secao">
        <h2>{t.registrados}</h2>
        {aportes.length === 0 ? <Vazio titulo={t.vazioTitulo} texto={t.vazioTexto} /> : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead><tr>
                <th>{d.comum.data}</th><th>{t.participante}</th><th>{t.tipo}</th><th>{t.descricao}</th>
                <th className="num">{d.exportacao.valor}</th>{pode.administrar && <th>{d.comum.acoes}</th>}
              </tr></thead>
              <tbody>
                {aportes.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">{f.data(a.data)}</td>
                    <td className="font-medium">{nomePorId.get(a.participante_id) ?? "—"}</td>
                    <td>{d.enums.tipoAporte[a.tipo]}</td>
                    <td>{a.descricao}{a.observacoes && <span className="block text-stone">{a.observacoes}</span>}</td>
                    <td className="num font-semibold">{f.moeda(Number(a.valor), m)}</td>
                    {pode.administrar && (
                      <td><BotaoExcluir action={excluirAporte} id={a.id} projetoId={projeto.id} confirmacao={fmtTexto(t.excluirConfirma, { descricao: a.descricao })} rotulo={d.comum.excluir} /></td>
                    )}
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
