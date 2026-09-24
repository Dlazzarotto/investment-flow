/**
 * Documentos do cliente (0021) — regras puras, testadas em tests/documentos.test.ts.
 * O arquivo vai para o bucket privado "documentos"; a 1ª pasta do caminho é a
 * empresa, e é por ela que as políticas do Storage decidem quem lê.
 */
import type { ClienteDocumento } from "./types";

export const BUCKET_DOCUMENTOS = "documentos";
/** 20 MB — o mesmo limite do bucket (0021). */
export const TAMANHO_MAX = 20 * 1024 * 1024;
/** Os mesmos tipos que o bucket aceita (0021). */
export const TIPOS_ARQUIVO = [
  "application/pdf", "image/jpeg", "image/png", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

/**
 * Nome que o Storage aceita sem surpresa: sem pasta, sem acento, sem espaço nem
 * símbolo — "CIS Shandong Ç/2026.pdf" vira "CIS-Shandong-C-2026.pdf".
 */
export function nomeSeguro(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? "";
  const limpo = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|-+$/g, "");
  return (limpo || "arquivo").slice(-120);
}

export function caminhoDocumento(organizacaoId: string, clienteId: string, id: string, nome: string): string {
  return `${organizacaoId}/clientes/${clienteId}/${id}-${nomeSeguro(nome)}`;
}

/** Motivo da recusa, ou null se o arquivo pode subir. */
export function validarArquivo(a: { size: number; type: string }): "vazio" | "grande" | "tipo" | null {
  if (a.size <= 0) return "vazio";
  if (a.size > TAMANHO_MAX) return "grande";
  if (!(TIPOS_ARQUIVO as readonly string[]).includes(a.type)) return "tipo";
  return null;
}

export type SituacaoCis = { estado: "sem_cis" } | { estado: "vencido"; dias: number }
  | { estado: "vence"; dias: number } | { estado: "ok" };

/**
 * O CIS abre o cliente (com a LOI). Olha o CIS mais recente: sem nenhum, vencido,
 * vencendo em até `janela` dias, ou em dia. CIS sem validade conta como em dia.
 */
export function situacaoCis(docs: Pick<ClienteDocumento, "tipo" | "validade" | "criado_em">[], hoje: string, janela = 30): SituacaoCis {
  const cis = docs.filter((x) => x.tipo === "cis").sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  if (cis.length === 0) return { estado: "sem_cis" };
  // Vale o de validade mais longa entre os arquivados: um CIS novo substitui o velho.
  const validades = cis.map((x) => x.validade);
  if (validades.some((v) => v === null)) return { estado: "ok" };
  const ultima = (validades as string[]).sort().pop()!;
  const dia = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;
  const dias = dia(ultima) - dia(hoje);
  if (dias < 0) return { estado: "vencido", dias: -dias };
  if (dias <= janela) return { estado: "vence", dias };
  return { estado: "ok" };
}
