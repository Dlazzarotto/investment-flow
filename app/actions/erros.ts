import type { PostgrestError } from "@supabase/supabase-js";
import { fmtTexto, type Dicionario } from "@/lib/i18n";

type Entidade = keyof Dicionario["entidades"];

/** Converte erros do Postgres/Supabase em mensagens no idioma do usuário. */
export function traduzirErroBanco(err: PostgrestError, entidade: Entidade, d: Dicionario): string {
  const nome = d.entidades[entidade];
  // 0027: um e-mail, uma empresa. Sem isto viraria "já existe" — motivo certo, explicação nenhuma.
  if (err.code === "23505" && err.message.includes("organizacao_membros_email_uq")) return d.master.emailEmOutraEmpresa;
  // Índices únicos que não são de nome: número do contrato/monetização (0018/0019) e e-mail no projeto.
  if (err.code === "23505" && /_numero_uq/.test(err.message)) return fmtTexto(d.banco.numeroDuplicado, { entidade: nome });
  if (err.code === "23505" && /_email_uq/.test(err.message)) return d.banco.emailDuplicado;
  if (err.code === "23505") return fmtTexto(d.banco.duplicado, { entidade: nome });
  // 0007/0028: a empresa não fica sem administrador; o master não administra empresa.
  if (err.code === "23514" && err.message.includes("precisa ter ao menos um sócio")) return d.master.ultimoAdmin;
  if (err.code === "23514" && err.message.includes("organizacao_membros_nao_master_ck")) return d.master.masterNaoAdmin;
  if (err.message.includes("assentos e todos estão ocupados")) return d.organizacao.semAssento;
  if (err.code === "23514" || err.code === "P0001") {
    if (err.message.includes("ultrapassa 100")) {
      const m = err.message.match(/total: ([\d.,]+)/);
      return fmtTexto(d.banco.participacao, { total: m ? fmtTexto(d.banco.totalSufixo, { v: m[1] }) : "" });
    }
    if (err.message.includes("contratos_conta_ck")) return d.banco.contaProjeto;
    return d.banco.travas;
  }
  // numeric_value_out_of_range: estoura numeric(16,2)/numeric(18,2) (ex.: quantidade × valor unitário enorme)
  if (err.code === "22003") return d.banco.foraDaFaixa;
  // foreign_key_violation tem dois sentidos: APAGAR algo que um contrato ainda usa
  // (on delete restrict) ou GRAVAR apontando para algo inexistente ou de outra
  // empresa (chave composta com organizacao_id, 0018).
  if (err.code === "23503") {
    return err.message.startsWith("update or delete") ? fmtTexto(d.banco.emUso, { entidade: nome }) : d.banco.referenciaInvalida;
  }
  if (err.code === "42501" || err.code === "PGRST301") return d.comum.semPermissao;
  return fmtTexto(d.banco.falha, { entidade: nome, msg: err.message });
}
