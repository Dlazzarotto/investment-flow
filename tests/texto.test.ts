import { describe, expect, it } from "vitest";
import { mesmoNome } from "@/lib/texto";

describe("mesmoNome (confirmação de exclusão)", () => {
  it("ignora maiúsculas, acentos e espaços", () => {
    expect(mesmoNome("MINERADORA BOLIVIA", "Mineradora Bolívia")).toBe(true);
    expect(mesmoNome("  mineradora   bolivia ", "Mineradora Bolivia")).toBe(true);
  });
  it("nome diferente ou vazio não confere", () => {
    expect(mesmoNome("Mineradora Peru", "Mineradora Bolívia")).toBe(false);
    expect(mesmoNome("   ", "")).toBe(false);
  });
});
