import type { PostgrestError } from "@supabase/supabase-js";
import { fmtTexto, type Dicionario } from "@/lib/i18n";

type Entidade = keyof Dicionario["entidades"];

/** Converte erros do Postgres/Supabase em mensagens no idioma do usuário. */
export function traduzirErroBanco(err: PostgrestError, entidade: Entidade, d: Dicionario): string {
  const nome = d.entidades[entidade];
  if (err.code === "23505") return fmtTexto(d.banco.duplicado, { entidade: nome });
  if (err.code === "23514" || err.code === "P0001") {
    if (err.message.includes("ultrapassa 100")) {
      const m = err.message.match(/total: ([\d.,]+)/);
      return fmtTexto(d.banco.participacao, { total: m ? fmtTexto(d.banco.totalSufixo, { v: m[1] }) : "" });
    }
    return d.banco.travas;
  }
  if (err.code === "42501" || err.code === "PGRST301") return d.comum.semPermissao;
  return fmtTexto(d.banco.falha, { entidade: nome, msg: err.message });
}
