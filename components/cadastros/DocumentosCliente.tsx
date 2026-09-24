"use client";
import { useRef, useState } from "react";
import { excluirDocumento, registrarDocumento } from "@/app/actions/cadastros";
import { Mensagem } from "@/components/ui/Mensagem";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/client";
import { fmtTexto } from "@/lib/i18n";
import { formatadores } from "@/lib/format";
import { BUCKET_DOCUMENTOS, TIPOS_ARQUIVO, caminhoDocumento, validarArquivo } from "@/lib/documentos";
import { TIPOS_DOCUMENTO_CLIENTE, type ActionState, type ClienteDocumento } from "@/lib/types";

/**
 * Documentos do cliente: CIS, LOI, ICPO, KYC… O arquivo sobe do navegador direto
 * ao bucket privado (as políticas do Storage conferem a empresa pela 1ª pasta do
 * caminho) e só então o registro é gravado. Abrir gera um link assinado de 60 s:
 * o arquivo nunca fica público.
 */
export function DocumentosCliente({ organizacaoId, clienteId, docs }:
  { organizacaoId: string; clienteId: string; docs: ClienteDocumento[] }) {
  const { d, locale } = useI18n();
  const f = formatadores(locale);
  const t = d.documentos;
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<ActionState | null>(null);
  const form = useRef<HTMLFormElement>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const arquivo = fd.get("arquivo");
    if (!(arquivo instanceof File)) return;
    const motivo = validarArquivo(arquivo);
    if (motivo) { setEstado({ ok: false, erro: t.recusa[motivo] }); return; }
    setEnviando(true); setEstado(null);
    const caminho = caminhoDocumento(organizacaoId, clienteId, crypto.randomUUID(), arquivo.name);
    const { error } = await createClient().storage.from(BUCKET_DOCUMENTOS).upload(caminho, arquivo, { contentType: arquivo.type });
    if (error) {
      setEnviando(false);
      setEstado({ ok: false, erro: fmtTexto(d.banco.falha, { entidade: d.entidades.documento, msg: error.message }) });
      return;
    }
    const r = await registrarDocumento({
      organizacao_id: organizacaoId, cliente_id: clienteId, tipo: String(fd.get("tipo")), nome_arquivo: arquivo.name,
      caminho, tamanho: String(arquivo.size), mime: arquivo.type,
      emitido_em: String(fd.get("emitido_em") ?? ""), validade: String(fd.get("validade") ?? ""),
      observacoes: String(fd.get("observacoes") ?? ""),
    });
    setEnviando(false); setEstado(r);
    if (r.ok) form.current?.reset();
  }

  async function abrir(caminho: string) {
    // Abre a aba já no clique (o navegador bloqueia janela aberta depois de um await).
    const aba = window.open("", "_blank");
    const { data, error } = await createClient().storage.from(BUCKET_DOCUMENTOS).createSignedUrl(caminho, 60);
    if (error || !data) { aba?.close(); setEstado({ ok: false, erro: t.naoAbriu }); return; }
    if (aba) aba.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  }

  return (
    <div className="mt-3">
      <button type="button" className="btn-quieto px-3 text-sm" onClick={() => setAberto(!aberto)}>
        {t.titulo} ({docs.length})
      </button>
      {aberto && (
        <div className="mt-3 rounded-md border border-stone-light bg-stone-paper p-3">
          {docs.length === 0 ? <p className="text-stone">{t.vazio}</p> : (
            <ul className="grid gap-2">
              {docs.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white p-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-navy">{d.enums.tipoDocumentoCliente[x.tipo]}</p>
                    <p className="break-all text-stone">{x.nome_arquivo}</p>
                    <p className="text-sm text-stone">
                      {[x.emitido_em ? `${t.emitido}: ${f.data(x.emitido_em)}` : null,
                        x.validade ? `${t.validade}: ${f.data(x.validade)}` : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn-quieto px-3" onClick={() => abrir(x.caminho)}>{t.abrir}</button>
                    <form action={excluirDocumento}
                          onSubmit={(e) => { if (!window.confirm(fmtTexto(t.excluirConfirma, { nome: x.nome_arquivo }))) e.preventDefault(); }}>
                      <input type="hidden" name="id" value={x.id} />
                      <button type="submit" className="btn-perigo px-3">{d.comum.excluir}</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <form ref={form} onSubmit={enviar} className="mt-3 grid gap-3 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <label className="rotulo" htmlFor={`dtipo-${clienteId}`}>{t.tipo}</label>
              <select id={`dtipo-${clienteId}`} name="tipo" className="campo" defaultValue="cis">
                {TIPOS_DOCUMENTO_CLIENTE.map((x) => <option key={x} value={x}>{d.enums.tipoDocumentoCliente[x]}</option>)}
              </select>
            </div>
            <div className="sm:col-span-4">
              <label className="rotulo" htmlFor={`darq-${clienteId}`}>{t.arquivo}</label>
              <input id={`darq-${clienteId}`} name="arquivo" type="file" required accept={TIPOS_ARQUIVO.join(",")}
                     className="campo py-2" />
            </div>
            <div className="sm:col-span-3">
              <label className="rotulo" htmlFor={`demi-${clienteId}`}>{t.emitido}</label>
              <input id={`demi-${clienteId}`} name="emitido_em" type="date" className="campo" />
            </div>
            <div className="sm:col-span-3">
              <label className="rotulo" htmlFor={`dval-${clienteId}`}>{t.validade}</label>
              <input id={`dval-${clienteId}`} name="validade" type="date" className="campo" />
            </div>
            <div className="sm:col-span-6">
              <label className="rotulo" htmlFor={`dobs-${clienteId}`}>{t.observacoes}</label>
              <input id={`dobs-${clienteId}`} name="observacoes" maxLength={1000} className="campo" />
            </div>
            <div className="sm:col-span-6">
              <button type="submit" disabled={enviando} aria-busy={enviando} className="btn-quieto">
                {enviando ? t.enviando : t.enviar}
              </button>
              <p className="mt-1 text-sm text-stone">{t.ajuda}</p>
            </div>
          </form>
          {estado && <Mensagem estado={estado} />}
        </div>
      )}
    </div>
  );
}
