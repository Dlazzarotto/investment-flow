import { describe, expect, it } from "vitest";
import { TAMANHO_MAX, caminhoDocumento, nomeSeguro, situacaoCis, validarArquivo } from "@/lib/documentos";

describe("Documentos do cliente", () => {
  it("nome seguro: sem pasta, acento, espaço ou símbolo", () => {
    expect(nomeSeguro("CIS Shandong Ç/2026.pdf")).toBe("2026.pdf");
    expect(nomeSeguro("CIS Shandong Ação 2026.pdf")).toBe("CIS-Shandong-Acao-2026.pdf");
    expect(nomeSeguro("C:\\\\docs\\\\..\\\\kyc.PDF")).toBe("kyc.PDF");
    expect(nomeSeguro("???")).toBe("arquivo");
    expect(nomeSeguro("../../etc/passwd")).toBe("passwd");
  });
  it("caminho começa pela empresa — é por ela que o Storage decide quem lê", () => {
    expect(caminhoDocumento("org", "cli", "u1", "CIS final.pdf")).toBe("org/clientes/cli/u1-CIS-final.pdf");
  });
  it("valida tamanho e tipo como o bucket", () => {
    expect(validarArquivo({ size: 1000, type: "application/pdf" })).toBeNull();
    expect(validarArquivo({ size: 0, type: "application/pdf" })).toBe("vazio");
    expect(validarArquivo({ size: TAMANHO_MAX + 1, type: "application/pdf" })).toBe("grande");
    expect(validarArquivo({ size: 10, type: "application/x-msdownload" })).toBe("tipo");
  });
  it("situação do CIS: sem, vencido, vencendo, em dia", () => {
    const hoje = "2026-09-24";
    const doc = (validade: string | null, tipo: "cis" | "loi" = "cis", criado_em = "2026-01-01") => ({ tipo, validade, criado_em });
    expect(situacaoCis([doc("2027-01-01", "loi")], hoje)).toEqual({ estado: "sem_cis" });
    expect(situacaoCis([doc("2026-09-20")], hoje)).toEqual({ estado: "vencido", dias: 4 });
    expect(situacaoCis([doc("2026-10-04")], hoje)).toEqual({ estado: "vence", dias: 10 });
    expect(situacaoCis([doc("2027-09-01")], hoje)).toEqual({ estado: "ok" });
    expect(situacaoCis([doc(null)], hoje)).toEqual({ estado: "ok" });
    // CIS novo substitui o vencido
    expect(situacaoCis([doc("2026-01-01"), doc("2027-09-01", "cis", "2026-09-01")], hoje)).toEqual({ estado: "ok" });
  });
});
