/**
 * Compara o nome digitado para confirmar uma exclusão com o nome gravado sem
 * exigir maiúsculas, acentos e espaços idênticos: "MINERADORA BOLIVIA" confere
 * com "Mineradora Bolívia". A confirmação existe para provar que a pessoa sabe
 * O QUE está excluindo, não para testar digitação.
 */
export function normalizarNome(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

export function mesmoNome(a: string, b: string): boolean {
  const x = normalizarNome(a);
  return x.length > 0 && x === normalizarNome(b);
}
