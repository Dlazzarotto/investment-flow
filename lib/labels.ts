/** Símbolos de moeda (independentes de idioma). Rótulos traduzíveis ficam em lib/i18n/dicionarios/*.enums */
import type { Moeda } from "./types";

export const LABEL_MOEDA: Record<Moeda, string> = { USD: "US$", BRL: "R$", EUR: "€", GBP: "£" };
