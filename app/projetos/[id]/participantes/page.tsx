import { FormProjeto } from "@/components/forms/FormProjeto";
import { FormParticipante } from "@/components/forms/FormParticipante";
import { FormMembro } from "@/components/forms/FormMembro";
import { FormPin } from "@/components/forms/FormPin";
import { FormConvite } from "@/components/forms/FormConvite";
import { BotaoExcluir } from "@/components/ui/BotaoExcluir";
import { Vazio } from "@/components/ui/Vazio";
import { ConfirmarExclusaoProjeto } from "@/components/ConfirmarExclusaoProjeto";
import { atualizarProjeto, excluirProjeto } from "@/app/actions/projetos";
import { excluirParticipante } from "@/app/actions/participantes";
import { removerMembro } from "@/app/actions/membros";
import { revogarConvite } from "@/app/actions/acesso";
import { listarConvites, listarMembros, listarParticipantes, obterPapel, obterProjeto, projetoTemPin } from "@/lib/consultas";
import { permissoes } from "@/lib/permissoes";
import { totalParticipacao } from "@/lib/calculos";
import { obterD } from "@/lib/i18n/server";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";

export default async function ParticipantesPage({ params }: { params: { id: string } }) {
  const { locale, d } = obterD();
  const f = formatadores(locale);
  const projeto = await obterProjeto(params.id);
  const papel = await obterPapel(projeto.id);
  const pode = permissoes(papel);
  const [participantes, membros, convites, temPin] = await Promise.all([
    listarParticipantes(projeto.id), listarMembros(projeto.id),
    pode.administrar ? listarConvites(projeto.id) : Promise.resolve([]),
    projetoTemPin(projeto.id),
  ]);
  const alocado = totalParticipacao(projeto, participantes);
  const disponivel = Math.round((100 - alocado) * 100) / 100;
  const t = d.parceria;
  const pctDono = Math.min(projeto.participacao_pct, 100);
  const ehDono = pode.ehDono;
  const editavel = pode.administrar;

  return (
    <>
      <h1 className="text-2xl">{t.titulo}</h1>
      <p className="mt-1 text-stone">{t.subtitulo}</p>
      {!ehDono && <p className="mt-3 rounded-md border-l-4 border-navy bg-navy-soft px-4 py-3">{d.membros.somenteDono}</p>}

      {ehDono && (
        <section className="secao max-w-3xl"><h2>{t.estrutura}</h2><FormProjeto action={atualizarProjeto} projeto={projeto} /></section>
      )}

      <section className="secao">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="mb-0">{t.participantes}</h2>
          <p className="text-stone">
            {t.alocado}: <span className="num font-semibold text-navy">{f.numero(alocado, 2)} %</span>
            {" · "}{t.disponivel}: <span className={`num font-semibold ${disponivel > 0 ? "text-gain" : "text-stone"}`}>{f.numero(disponivel, 2)} %</span>
          </p>
        </div>
        <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-stone-light" aria-hidden>
          <div className="h-full bg-navy" style={{ width: `${pctDono}%` }} />
          <div className="-mt-3 h-full bg-orange" style={{ width: `${Math.min(alocado, 100)}%`, marginLeft: `${pctDono}%`, maxWidth: `${Math.max(0, 100 - pctDono)}%` }} />
        </div>
        <p className="mb-6 text-stone">{t.legenda}</p>
        {participantes.length === 0 ? <Vazio titulo={t.vazioTitulo} texto={t.vazioTexto} /> : (
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead><tr>
                <th>{d.comum.nome}</th><th>{t.papel}</th><th className="num">{t.participacao}</th><th>{d.comum.contato}</th>
                {editavel && <th>{d.comum.acoes}</th>}
              </tr></thead>
              <tbody>
                <tr className="bg-navy-soft/60">
                  <td className="font-medium">{t.voce}</td><td>{t.dono}</td><td className="num">{f.numero(projeto.participacao_pct, 2)} %</td><td>—</td>
                  {editavel && <td></td>}
                </tr>
                {participantes.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.nome}</td>
                    <td>{d.enums.tipoParticipante[p.tipo]}</td>
                    <td className="num">{f.numero(Number(p.percentual), 2)} %</td>
                    <td>{p.contato ?? "—"}</td>
                    {editavel && (
                      <td><BotaoExcluir action={excluirParticipante} id={p.id} projetoId={projeto.id} confirmacao={fmtTexto(t.removerConfirma, { nome: p.nome })} rotulo={d.comum.remover} /></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editavel && (
        <section className="secao max-w-3xl"><h2>{t.adicionar}</h2><FormParticipante projetoId={projeto.id} disponivel={disponivel} /></section>
      )}

      <section className="secao">
        <h2>{d.membros.titulo}</h2>
        <p className="mb-4 text-stone">{ehDono ? d.membros.subtitulo : d.membros.somenteDono}</p>
        {ehDono && <p className="mb-6 rounded-md border-l-4 border-orange bg-orange-soft px-4 py-3">{d.membros.avisoConfirmacao}</p>}
        <h3 className="mb-3 text-lg text-navy">{d.membros.lista}</h3>
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead><tr>
              <th>{d.membros.email}</th><th>{d.membros.papel}</th><th>{d.comum.data}</th>
              {ehDono && <th>{d.comum.acoes}</th>}
            </tr></thead>
            <tbody>
              <tr className="bg-navy-soft/60">
                <td className="font-medium">{d.membros.voceDono}</td><td>{t.dono}</td><td>{f.data(projeto.criado_em)}</td>
                {ehDono && <td></td>}
              </tr>
              {membros.map((m) => (
                <tr key={m.id}>
                  <td className="break-all font-medium">{m.email}</td>
                  <td>{d.enums.papelMembro[m.papel]}</td>
                  <td className="whitespace-nowrap">{f.data(m.criado_em)}</td>
                  {ehDono && (
                    <td><BotaoExcluir action={removerMembro} id={m.id} projetoId={projeto.id} confirmacao={fmtTexto(d.membros.removerConfirma, { email: m.email })} rotulo={d.comum.remover} /></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {membros.length === 0 && <div className="mt-4"><Vazio titulo={d.membros.vazioTitulo} texto={d.membros.vazioTexto} /></div>}
        {editavel && <div className="mt-6 max-w-3xl"><FormMembro projetoId={projeto.id} /></div>}
      </section>

      {editavel && (
        <section className="secao">
          <h2>{d.acesso.convites}</h2>
          <div className="max-w-3xl"><FormConvite projetoId={projeto.id} /></div>
          <h3 className="mb-3 mt-8 text-lg text-navy">{d.acesso.listaConvites}</h3>
          {convites.length === 0 ? <Vazio titulo={d.acesso.semConvites} texto={d.acesso.semConvitesTexto} /> : (
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead><tr>
                  <th>{d.membros.papel}</th><th>{d.acesso.expiraEm}</th><th className="num">{d.acesso.usos}</th>
                  <th>{d.comum.total}</th><th>{d.comum.acoes}</th>
                </tr></thead>
                <tbody>
                  {convites.map((c) => {
                    const situacao = c.revogado ? d.acesso.revogado
                      : new Date(c.expira_em) < new Date() ? d.acesso.vencido
                      : c.usos >= c.max_usos ? d.acesso.esgotado : d.acesso.ativo;
                    const ativo = situacao === d.acesso.ativo;
                    return (
                      <tr key={c.id} className={ativo ? "" : "text-stone"}>
                        <td className="font-medium">{d.enums.papelMembro[c.papel]}</td>
                        <td className="whitespace-nowrap">{f.data(c.expira_em)}</td>
                        <td className="num">{fmtTexto(d.acesso.usosDe, { usos: c.usos, max: c.max_usos })}</td>
                        <td>{situacao}</td>
                        <td>
                          {ativo && (
                            <BotaoExcluir action={revogarConvite} id={c.id} projetoId={projeto.id}
                                          confirmacao={d.acesso.revogarConfirma} rotulo={d.acesso.revogar} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {editavel && (
        <section className="secao max-w-3xl">
          <h2>{d.acesso.pin}</h2>
          <FormPin projetoId={projeto.id} temPin={temPin} />
        </section>
      )}

      {ehDono && (
        <section className="secao max-w-3xl border-t border-stone-light pt-8">
          <h2 className="text-loss">{t.excluirProjeto}</h2>
          <p className="mb-4 text-stone">{t.excluirTexto}</p>
          <ConfirmarExclusaoProjeto action={excluirProjeto} projetoId={projeto.id} nome={projeto.nome} />
        </section>
      )}
    </>
  );
}
