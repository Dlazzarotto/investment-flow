import { describe, expect, it } from "vitest";
import { LOCALES, detectarLocale, fmtTexto, obterDicionario, rotuloUnidade } from "@/lib/i18n";
import { pt } from "@/lib/i18n/dicionarios/pt";
import { formatadores } from "@/lib/format";
import { criarSchemas } from "@/lib/validacao";
import { traduzirErroBanco } from "@/app/actions/erros";
import type { PostgrestError } from "@supabase/supabase-js";

function chaves(obj: unknown, prefixo = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefixo];
  return Object.entries(obj).flatMap(([k, v]) => chaves(v, prefixo ? `${prefixo}.${k}` : k));
}

describe("Dicionários", () => {
  const base = chaves(pt).sort();
  for (const l of LOCALES) {
    it(`${l}: mesmas chaves do pt, sem valores vazios, mesmos placeholders {x}`, () => {
      const dic = obterDicionario(l);
      expect(chaves(dic).sort()).toEqual(base);
      for (const k of base) {
        const vPt = k.split(".").reduce<any>((o, p) => o[p], pt) as string;
        const v = k.split(".").reduce<any>((o, p) => o[p], dic) as string;
        expect(typeof v, k).toBe("string");
        expect(v.trim().length, k).toBeGreaterThan(0);
        const ph = (t: string) => (t.match(/\{\w+\}/g) ?? []).sort();
        expect(ph(v), k).toEqual(ph(vPt));
      }
    });
  }
  it("fmtTexto substitui placeholders e mantém os desconhecidos", () => {
    expect(fmtTexto("{a} e {b}", { a: 1, b: "x" })).toBe("1 e x");
    expect(fmtTexto("{a} e {c}", { a: 1 })).toBe("1 e {c}");
  });
  it("rotuloUnidade traduz as unidades conhecidas e devolve as demais como estão", () => {
    expect(rotuloUnidade("Toneladas", obterDicionario("en"))).toBe("Tonnes");
    expect(rotuloUnidade("Toneladas", obterDicionario("zh"))).toBe("吨");
    expect(rotuloUnidade("m³", obterDicionario("es"))).toBe("m³");
    // unidade antiga/importada que não está em UNIDADES_VOLUME não pode sumir da tela
    expect(rotuloUnidade("Sacas 60 kg", obterDicionario("pt"))).toBe("Sacas 60 kg");
    expect(rotuloUnidade("", obterDicionario("pt"))).toBe("");
  });
  it("detecta idioma pelo Accept-Language com fallback pt", () => {
    expect(detectarLocale("es-MX,es;q=0.9,en;q=0.8")).toBe("es");
    expect(detectarLocale("zh-CN,zh;q=0.9")).toBe("zh");
    expect(detectarLocale("fr-FR,fr;q=0.9")).toBe("pt");
    expect(detectarLocale(null)).toBe("pt");
  });
});

describe("Formatação por idioma", () => {
  it("moeda, data e mês respeitam cada locale (datas em UTC, sem deslocar o dia)", () => {
    expect(formatadores("pt").moeda(1234.5, "USD")).toMatch(/US\$\s?1\.234,50/);
    expect(formatadores("en").moeda(1234.5, "USD")).toBe("$1,234.50");
    expect(formatadores("es").moeda(1234.5, "EUR")).toMatch(/1234,50\s?€/);
    expect(formatadores("zh").moeda(1234.5, "USD")).toMatch(/US\$1,234\.50/);
    expect(formatadores("pt").data("2026-03-01")).toBe("01/03/2026");
    expect(formatadores("en").data("2026-03-01")).toBe("03/01/2026");
    expect(formatadores("zh").data("2026-03-01")).toBe("2026/03/01");
    expect(formatadores("pt").mesLongo("2026-12-01")).toBe("dezembro de 2026");
    expect(formatadores("en").mesLongo("2026-12-01")).toBe("December 2026");
    expect(formatadores("zh").mesLongo("2026-12-01")).toBe("2026年12月");
    expect(formatadores("en").mesCurto("2026-03-01")).toBe("Mar/26");
    expect(formatadores("es").mesCurto("2026-03-01")).toBe("mar/26");
    expect(formatadores("en").pct(0.7048)).toBe("70.5 %");
    expect(formatadores("pt").pct(null)).toBe("—");
  });
});

describe("Mensagens traduzidas", () => {
  it("validação zod usa o idioma do dicionário", () => {
    const en = criarSchemas(obterDicionario("en"));
    expect(en.projeto.safeParse({ nome: "", data_inicio: "2026-01-01", moeda: "USD", tipo_parceria: "investidor", participacao_pct: "10" }).error?.issues[0].message).toBe("Project name is required.");
    const zh = criarSchemas(obterDicionario("zh"));
    expect(zh.investimento.safeParse({ projeto_id: "11111111-1111-4111-8111-111111111111", item: "x", categoria: "logistica", quantidade: "0", valor_unitario: "1", data: "2026-01-01" }).error?.issues[0].message).toBe("数量必须大于零。");
  });
  it("erros do banco são traduzidos", () => {
    const err = (code: string, message = "") => ({ code, message, details: "", hint: "" } as PostgrestError);
    expect(traduzirErroBanco(err("23505"), "projeto", obterDicionario("en"))).toBe("A project with this name already exists.");
    expect(traduzirErroBanco(err("P0001", "A soma das participações do projeto ultrapassa 100% (total: 101.00 %)."), "participante", obterDicionario("es")))
      .toBe("La suma de las participaciones supera el 100 % (total: 101.00 %). Ajuste los porcentajes.");
    expect(traduzirErroBanco(err("42501"), "venda", obterDicionario("zh"))).toBe("您没有执行此操作的权限。");
    expect(traduzirErroBanco(err("22003", "numeric field overflow"), "investimento", obterDicionario("en"))).toMatch(/^Value outside the range/);
    // 23503 tem dois sentidos: apagar o que um contrato usa, ou gravar apontando para outra empresa.
    expect(traduzirErroBanco(err("23503", 'update or delete on table "clientes" violates foreign key constraint "contratos_contraparte_fk" on table "contratos"'),
      "cliente", obterDicionario("pt"))).toMatch(/^Não é possível excluir: este cliente está em uso/);
    expect(traduzirErroBanco(err("23503", 'insert or update on table "contratos" violates foreign key constraint "contratos_contraparte_fk"'),
      "contrato", obterDicionario("pt"))).toBe(obterDicionario("pt").banco.referenciaInvalida);
    // Índice único de NÚMERO ou de e-mail não é "já existe com esse nome".
    expect(traduzirErroBanco(err("23505", 'duplicate key value violates unique constraint "contratos_numero_uq"'), "contrato", obterDicionario("pt")))
      .toBe("Já existe um contrato com esse número.");
    expect(traduzirErroBanco(err("23505", 'duplicate key value violates unique constraint "participantes_projeto_email_uq"'), "participante", obterDicionario("pt")))
      .toBe(obterDicionario("pt").banco.emailDuplicado);
    expect(traduzirErroBanco(err("23514", 'new row for relation "contratos" violates check constraint "contratos_conta_ck"'), "contrato", obterDicionario("pt")))
      .toBe(obterDicionario("pt").banco.contaProjeto);
    // A trava genérica não afirma mais um motivo que pode não ser o verdadeiro.
    expect(obterDicionario("pt").banco.travas).not.toMatch(/maiores que zero/);
  });
});
