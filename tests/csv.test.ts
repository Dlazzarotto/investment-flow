import { describe, expect, it } from "vitest";
import { formatoCsv, montarCsv, numeroCsv } from "@/lib/csv";
import { LOCALES } from "@/lib/i18n";

describe("CSV por idioma", () => {
  it("pt e es usam ';' e vírgula decimal; en e zh usam ',' e ponto", () => {
    expect(formatoCsv("pt")).toEqual({ separador: ";", decimal: "," });
    expect(formatoCsv("es")).toEqual({ separador: ";", decimal: "," });
    expect(formatoCsv("en")).toEqual({ separador: ",", decimal: "." });
    expect(formatoCsv("zh")).toEqual({ separador: ",", decimal: "." });
  });

  it("números saem sem separador de milhar, com a vírgula decimal do idioma", () => {
    expect(numeroCsv(1234567.5, formatoCsv("pt"))).toBe("1234567,5");
    expect(numeroCsv(1234567.5, formatoCsv("en"))).toBe("1234567.5");
    expect(numeroCsv(250000, formatoCsv("pt"))).toBe("250000");
    expect(numeroCsv(Number.NaN, formatoCsv("pt"))).toBe("");
  });

  it("pt: diretiva sep=; BOM e campos com ';' entre aspas", () => {
    const csv = montarCsv([["Item", "Valor"], ["Barcaça; 2.000 t", 1234.5]], "pt");
    expect(csv.startsWith("﻿sep=;\r\n")).toBe(true);
    expect(csv).toContain('Item;Valor\r\n"Barcaça; 2.000 t";1234,5');
  });

  it("en: sem diretiva sep e campos com ',' entre aspas", () => {
    const csv = montarCsv([["Item", "Value"], ["Barge, 2,000 t", 1234.5]], "en");
    expect(csv.startsWith("﻿Item,Value")).toBe(true);
    expect(csv).toContain('"Barge, 2,000 t",1234.5');
  });

  it("aspas internas dobram e quebras de linha ficam protegidas em todos os idiomas", () => {
    for (const l of LOCALES) {
      const csv = montarCsv([[`Diz "ok"`, "a\r\nb"]], l);
      expect(csv).toContain('"Diz ""ok"""');
      expect(csv).toContain('"a\r\nb"');
    }
  });

  it("uma linha por registro, terminada em CRLF entre linhas", () => {
    const csv = montarCsv([["a", 1], ["b", 2]], "en");
    expect(csv.replace("﻿", "").split("\r\n")).toEqual(["a,1", "b,2"]);
  });
});
