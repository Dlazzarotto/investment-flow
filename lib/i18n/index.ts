import { pt, type Dicionario } from "./dicionarios/pt";
import { en } from "./dicionarios/en";
import { es } from "./dicionarios/es";
import { zh } from "./dicionarios/zh";
import type { Locale } from "./config";

export type { Dicionario };
export * from "./config";

const DICIONARIOS: Record<Locale, Dicionario> = { pt, en, es, zh };

export function obterDicionario(locale: Locale): Dicionario {
  return DICIONARIOS[locale];
}

/** Substitui {chave} por valores: fmtTexto("Olá {nome}", { nome: "Ana" }) -> "Olá Ana". */
export function fmtTexto(modelo: string, vars: Record<string, string | number>): string {
  return modelo.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}
