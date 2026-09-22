/**
 * O que cada papel pode fazer. Espelha as funções de permissão de
 * supabase/migrations/0006_papeis_pin_convites.sql — o banco é quem decide de
 * verdade; isto existe para a tela não oferecer um botão que o RLS vai recusar.
 */
import type { PapelNoProjeto, Permissoes } from "./types";

export function permissoes(papel: PapelNoProjeto): Permissoes {
  const administrar = papel === "dono" || papel === "admin";
  return {
    verInvestimentos: administrar,
    lancar: papel !== null,
    alterar: administrar || papel === "manager",
    alterarComPin: papel === "escritorio",
    administrar,
    ehDono: papel === "dono",
  };
}
