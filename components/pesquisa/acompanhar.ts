"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PesquisaMercado } from "@/lib/types";

/**
 * Acompanha pesquisas em andamento: consulta /api/pesquisa-mercado/[id] a cada
 * 6 s até cada uma sair de "pesquisando" e então recarrega a página (o servidor
 * já gravou o resultado). Sair da tela não perde nada: a pesquisa continua no
 * agente e é retomada aqui na próxima visita.
 */
export function useAcompanharPesquisas(pendentes: string[]) {
  const router = useRouter();
  const [ativas, setAtivas] = useState<string[]>(pendentes);
  const chave = pendentes.join(",");
  useEffect(() => { setAtivas((a) => Array.from(new Set([...a, ...pendentes]))); }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  const ativasRef = useRef(ativas);
  ativasRef.current = ativas;

  useEffect(() => {
    if (ativas.length === 0) return;
    let parado = false;
    const tique = async () => {
      const terminadas: string[] = [];
      await Promise.all(ativasRef.current.map(async (id) => {
        try {
          const r = await fetch(`/api/pesquisa-mercado/${id}`, { cache: "no-store" });
          const j = (await r.json()) as { pesquisa?: PesquisaMercado };
          if (!r.ok || (j.pesquisa && j.pesquisa.status !== "pesquisando")) terminadas.push(id);
        } catch { /* rede instável: tenta de novo no próximo tique */ }
      }));
      if (parado) return;
      if (terminadas.length) {
        setAtivas((a) => a.filter((x) => !terminadas.includes(x)));
        router.refresh();
      }
    };
    const t = setInterval(tique, 6000);
    return () => { parado = true; clearInterval(t); };
  }, [ativas.length, router]);

  const acompanhar = (id: string) => setAtivas((a) => (a.includes(id) ? a : [...a, id]));
  return { ativas, acompanhar };
}

/** Pede uma pesquisa nova; devolve o id ou a mensagem de erro já traduzida pelo servidor. */
export async function pedirPesquisa(corpo: { commodity_id: string; grade_id?: string; base?: string; detalhado?: boolean; modo?: "livre" | "bolsas" }):
  Promise<{ id?: string; commodity_id?: string; erro?: string }> {
  try {
    const r = await fetch("/api/pesquisa-mercado", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo),
    });
    const j = (await r.json()) as { id?: string; commodity_id?: string; erro?: string };
    return r.ok ? { id: j.id, commodity_id: j.commodity_id } : { erro: j.erro ?? String(r.status) };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }
}
