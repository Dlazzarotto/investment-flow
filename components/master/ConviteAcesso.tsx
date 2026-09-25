"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";

/**
 * O convite que o master manda ao administrador de uma empresa: o link de
 * /criar-conta (conta só nasce por convite, 0025), com copiar e "enviar por
 * e-mail". O envio abre o e-mail de quem está usando, já com destinatário,
 * assunto e texto: não depende do servidor de e-mail do Supabase, que só
 * entrega para a equipe do próprio projeto. A origem só existe no navegador.
 */
export function ConviteAcesso({ empresa, emails }: { empresa: string; emails: string[] }) {
  const { d } = useI18n();
  const t = d.master;
  const [link, setLink] = useState("");
  const [copiado, setCopiado] = useState(false);
  useEffect(() => { setLink(`${window.location.origin}/criar-conta`); }, []);
  if (!link) return null;

  const assunto = fmtTexto(t.conviteAssunto, { empresa });
  const corpo = fmtTexto(t.conviteCorpo, { empresa, link });
  const mailto = `mailto:${emails.map(encodeURIComponent).join(",")}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;

  async function copiar() {
    try { await navigator.clipboard.writeText(corpo); setCopiado(true); }
    catch { /* sem permissão de área de transferência: o campo abaixo permite copiar à mão */ }
  }

  return (
    <div className="mt-4 rounded-md border-l-4 border-gain bg-green-50 px-4 py-4">
      <p className="font-semibold text-gain">{t.linkAcesso}</p>
      <p className="mt-1">{t.linkAcessoAjuda}</p>
      <input readOnly value={link} onFocus={(e) => e.currentTarget.select()}
             aria-label={t.linkAcesso} className="campo mt-3 bg-white" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copiar} className="btn-navy">{copiado ? d.acesso.copiado : d.acesso.copiar}</button>
        {emails.length > 0 && <a href={mailto} className="btn-quieto">{t.enviarEmail}</a>}
      </div>
    </div>
  );
}
