"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";

/**
 * O acesso que o master (re)envia a um administrador de empresa: /criar-conta para
 * quem ainda não tem senha (conta só nasce por convite, 0025) e /login para quem já
 * tem — o master não sabe qual é o caso. Com copiar e "enviar por
 * e-mail". O envio abre o e-mail de quem está usando, já com destinatário,
 * assunto e texto: não depende do servidor de e-mail do Supabase, que só
 * entrega para a equipe do próprio projeto. A origem só existe no navegador.
 */
export function ConviteAcesso({ empresa, emails }: { empresa: string; emails: string[] }) {
  const { d } = useI18n();
  const t = d.master;
  const [link, setLink] = useState("");
  const [login, setLogin] = useState("");
  const [copiado, setCopiado] = useState(false);
  // Os dois caminhos: quem ainda não tem conta cria a senha; quem já tem entra (e, se
  // esqueceu, pede outra na própria tela de login). O master não sabe qual é o caso.
  useEffect(() => { setLink(`${window.location.origin}/criar-conta`); setLogin(`${window.location.origin}/login`); }, []);
  if (!link) return null;

  const assunto = fmtTexto(t.conviteAssunto, { empresa });
  const corpo = fmtTexto(t.conviteCorpo, { empresa, link, login });
  const mailto = `mailto:${emails.map(encodeURIComponent).join(",")}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;

  async function copiar() {
    try { await navigator.clipboard.writeText(corpo); setCopiado(true); }
    catch { /* sem permissão de área de transferência: o campo abaixo permite copiar à mão */ }
  }

  return (
    <div className="mt-4 rounded-md border-l-4 border-gain bg-green-50 px-4 py-4">
      <p className="font-semibold text-gain">{t.linkAcesso}</p>
      <p className="mt-1">{t.linkAcessoAjuda}</p>
      <label className="rotulo mt-3 block">{t.linkPrimeiroAcesso}
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="campo mt-1 bg-white" />
      </label>
      <label className="rotulo mt-3 block">{t.linkJaTemConta}
        <input readOnly value={login} onFocus={(e) => e.currentTarget.select()} className="campo mt-1 bg-white" />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copiar} className="btn-navy">{copiado ? d.acesso.copiado : d.acesso.copiar}</button>
        {emails.length > 0 && <a href={mailto} className="btn-quieto">{t.enviarEmail}</a>}
      </div>
    </div>
  );
}
