import { describe, expect, it } from "vitest";
import { blocosResposta, extrairCotacao, extrairCotacoesBolsas, montarPergunta, montarPerguntaBolsas, variacao } from "@/lib/pesquisa";

const resposta = `Minério de ferro 62 % Fe CFR China: US$ 104,50/dmt.

| Fonte | Preço | Data |
|---|---|---|
| SGX | 104,50 | 24/09/2026 |

- Tendência de alta.

\`\`\`json
{"commodity": "Iron ore", "especificacao": "62% Fe fines", "base": "CFR China", "unidade": "USD/dmt", "preco": 104.5, "moeda": "usd", "data": "2026-09-24", "tipo": "futuro", "fonte": "SGX", "url": "https://www.sgx.com", "aproximacao": true}
\`\`\``;

describe("pesquisa de mercado", () => {
  it("lê a referência do JSON e normaliza moeda", () => {
    const c = extrairCotacao(resposta)!;
    expect(c.preco).toBe(104.5);
    expect(c.moeda).toBe("USD");
    expect(c.data).toBe("2026-09-24");
    expect(c.tipo).toBe("futuro");
    expect(c.aproximacao).toBe(true);
  });
  it("lista de bases: fica a primeira COM preço; preço ausente é null, nunca zero", () => {
    const t = '```json\n[{"base":"CFR África","preco":null},{"base":"CFR China","preco":"515,05","data":"2026-09-24"}]\n```';
    const c = extrairCotacao(t)!;
    expect(c.base).toBe("CFR China");
    expect(c.preco).toBe(515.05);
    expect(extrairCotacao('```json\n{"preco": null}\n```')!.preco).toBeNull();
  });
  it("campos inválidos viram null em vez de derrubar a leitura", () => {
    const c = extrairCotacao('```json\n{"preco": 10, "data": "24/09/2026", "tipo": "chute", "url": "javascript:alert(1)"}\n```')!;
    expect(c.preco).toBe(10);
    expect(c.data).toBeNull();
    expect(c.tipo).toBeNull();
    expect(c.url).toBeNull();
  });
  it("sem JSON legível: null (a resposta em texto continua valendo)", () => {
    expect(extrairCotacao("não encontrei preço público")).toBeNull();
    expect(extrairCotacao("```json\n{quebrado\n```")).toBeNull();
  });
  it("resposta para a tela: tira o JSON e separa a tabela", () => {
    const b = blocosResposta(resposta);
    expect(b.map((x) => x.tipo)).toEqual(["texto", "tabela", "texto"]);
    const tab = b[1] as { cabecalho: string[]; linhas: string[][] };
    expect(tab.cabecalho).toEqual(["Fonte", "Preço", "Data"]);
    expect(tab.linhas).toEqual([["SGX", "104,50", "24/09/2026"]]);
    expect(JSON.stringify(b)).not.toContain('"preco"');
  });
  it("pergunta leva idioma, grade, especificação e base", () => {
    const p = montarPergunta({ commodity: "Minério de ferro", grade: "Fines 62% Fe", especificacao: ["Fe ≥ 60 %"], base: "CFR China", idioma: "en" });
    expect(p).toContain("idioma: en");
    expect(p).toContain("Fines 62% Fe");
    expect(p).toContain("Fe ≥ 60 %");
    expect(p).toContain("CFR China");
  });
  it("variação só entre cotações comparáveis", () => {
    expect(variacao({ preco: 110, moeda: "USD", unidade: "USD/dmt" }, { preco: 100, moeda: "USD", unidade: "usd/dmt" })).toBe(10);
    expect(variacao({ preco: 110, moeda: "USD", unidade: "USD/dmt" }, { preco: 100, moeda: "USD", unidade: "USD/wmt" })).toBeNull();
    expect(variacao({ preco: 110, moeda: "USD", unidade: "t" }, null)).toBeNull();
  });

  it("bolsas: três praças sempre na mesma ordem, aceitando acento e maiúscula", () => {
    const t = '```json\n[{"mercado":"Chicago","bolsa":"CME","contrato":"TIO Nov26","preco":104.2,"moeda":"USD","unidade":"USD/t"},' +
      '{"mercado":"xangai","bolsa":"DCE","contrato":"I2601","preco":"785,5","moeda":"cny","unidade":"CNY/t","data":"2026-09-24"},' +
      '{"mercado":"Londres","negociado":false,"preco":null}]\n```';
    const c = extrairCotacoesBolsas(t);
    expect(c.map((x) => x.mercado)).toEqual(["xangai", "londres", "chicago"]);
    expect(c[0]).toMatchObject({ bolsa: "DCE", preco: 785.5, moeda: "CNY", negociado: true });
    expect(c[1]).toMatchObject({ negociado: false, preco: null });
    expect(c[2]).toMatchObject({ bolsa: "CME", preco: 104.2, negociado: true });
  });
  it("bolsas: praça ausente fica 'não informada' (negociado null), nunca zero", () => {
    const c = extrairCotacoesBolsas('```json\n[{"mercado":"londres","preco":515}]\n```');
    expect(c[0].preco).toBeNull();
    expect(c[0].negociado).toBeNull();
    expect(c[1].preco).toBe(515);
    expect(extrairCotacoesBolsas("sem json").every((x) => x.preco === null)).toBe(true);
  });
  it("pergunta do painel pede as três praças e a lista JSON", () => {
    const p = montarPerguntaBolsas({ commodity: "Cobre catodo", idioma: "zh" });
    expect(p).toContain("idioma: zh");
    expect(p).toMatch(/xangai[\s\S]*londres[\s\S]*chicago/);
    expect(p).toContain("negociado: false");
  });
});
