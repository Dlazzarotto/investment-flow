"use client";
import { useEffect, useState } from "react";
import { gerarConvite } from "@/app/actions/acesso";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Mensagem } from "@/components/ui/Mensagem";
import { useAcaoFormulario } from "@/components/ui/useAcaoFormulario";
import { useI18n } from "@/lib/i18n/client";
import { PAPEIS_CONVIDAVEIS } from "@/lib/types";

/**
 * Gera o link de convite. A action devolve o caminho no campo `sucesso`; o token
 * só existe nessa resposta — no banco fica apenas o hash dele.
 */
export function FormConvite({ projetoId }: { projetoId: string }) {
  const { d } = useI18n();
  const t = d.acesso;
  const [estado, formAction] = useAcaoFormulario(gerarConvite);
  const [link, setLink] = useState("");
  const [copiado, setCopiado] = useState(false);

  // O caminho vem relativo; a origem só existe no navegador.
  useEffect(() => {
    if (estado.ok && estado.sucesso?.startsWith("/convite/")) {
      setLink(`${window.location.origin}${estado.sucesso}`);
      setCopiado(false);
    }
  }, [estado.versao, estado.ok, estado.sucesso]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
    } catch {
      /* sem permissão de área de transferência: o campo abaixo permite copiar à mão */
    }
  }

  return (
    <>
      <p className="mb-4 text-stone">{t.convitesTexto}</p>
      <form action={formAction} className="grid gap-4 sm:grid-cols-6">
        <input type="hidden" name="projeto_id" value={projetoId} />
        <div className="sm:col-span-3">
          <label className="rotulo" htmlFor="c_papel">{t.papelDoLink}</label>
          <select id="c_papel" name="papel" className="campo" defaultValue="escritorio">
            {PAPEIS_CONVIDAVEIS.map((p) => <option key={p} value={p}>{d.enums.papelMembro[p]}</option>)}
          </select>
        </div>
        <div className="sm:col-span-1">
          <label className="rotulo" htmlFor="c_dias">{t.validade}</label>
          <input id="c_dias" name="dias" type="number" min={1} max={90} step={1} defaultValue={7} className="campo num" />
        </div>
        <div className="sm:col-span-1">
          <label className="rotulo" htmlFor="c_usos">{t.usos}</label>
          <input id="c_usos" name="max_usos" type="number" min={1} max={50} step={1} defaultValue={1} className="campo num" />
        </div>
        <div className="flex items-end sm:col-span-1"><SubmitButton>{t.gerar}</SubmitButton></div>
        {estado.erro && <div className="sm:col-span-6"><Mensagem estado={estado} /></div>}
      </form>

      {link && (
        <div className="mt-4 rounded-md border-l-4 border-gain bg-green-50 px-4 py-4">
          <p className="font-semibold text-gain">{t.linkGerado}</p>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()}
                 aria-label={t.copiar} className="campo mt-3 bg-white" />
          <button type="button" onClick={copiar} className="btn-navy mt-3">{copiado ? t.copiado : t.copiar}</button>
        </div>
      )}
    </>
  );
}
