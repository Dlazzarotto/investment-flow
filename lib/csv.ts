/**
 * Montagem de CSV por idioma (funções puras — testadas em tests/csv.test.ts).
 *
 * Excel em pt-BR e es-ES usa ";" como separador de lista e vírgula decimal: um CSV
 * com "," e "1234.5" abre tudo numa coluna só e trata os números como texto. Em
 * en-US e zh-CN vale o contrário. O XLSX continua sendo o formato "de máquina",
 * com números de verdade; o CSV é para abrir direto na planilha.
 */
import type { Locale } from "./i18n/config";

/** Idiomas cujo Excel espera ";" + vírgula decimal. */
const PONTO_E_VIRGULA: readonly Locale[] = ["pt", "es"];

export interface FormatoCsv {
  separador: "," | ";";
  decimal: "." | ",";
}

export function formatoCsv(locale: Locale): FormatoCsv {
  return PONTO_E_VIRGULA.includes(locale) ? { separador: ";", decimal: "," } : { separador: ",", decimal: "." };
}

/** Número sem separador de milhar (a planilha formata), com a vírgula decimal do idioma. */
export function numeroCsv(valor: number, f: FormatoCsv): string {
  if (!Number.isFinite(valor)) return "";
  const s = String(valor);
  return f.decimal === "," ? s.replace(".", ",") : s;
}

function celula(valor: string | number, f: FormatoCsv): string {
  const s = typeof valor === "number" ? numeroCsv(valor, f) : String(valor);
  // Aspas quando houver separador, aspas ou quebra de linha; aspas internas dobram.
  return new RegExp(`["\r\n${f.separador}]`).test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV completo: BOM (Excel reconhece UTF-8), diretiva `sep=` quando o separador não
 * é a vírgula (o Excel obedece; LibreOffice e pandas ignoram a linha) e CRLF.
 */
export function montarCsv(linhas: (string | number)[][], locale: Locale): string {
  const f = formatoCsv(locale);
  const corpo = linhas.map((l) => l.map((c) => celula(c, f)).join(f.separador)).join("\r\n");
  const cabecalho = f.separador === ";" ? `sep=${f.separador}\r\n` : "";
  return `﻿${cabecalho}${corpo}`;
}
