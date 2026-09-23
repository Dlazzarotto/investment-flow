import { describe, expect, it } from "vitest";
import { extrairJson, interpretarResposta, montarPrompt, textoFinal } from "@/lib/ia/estimativa";
import { montarPromptCusto } from "@/lib/ia/custo";
import { desvioVsMedia, normalizarItem } from "@/lib/calculos";
import { obterDicionario } from "@/lib/i18n";

const bom = `{"unidade_ref":"unidade","valor_min":400000,"valor_medio":520000,"valor_max":700000,"confianca":"media",
 "premissas":["Barcaça graneleira 2.000 t, usada, bacia amazônica","Cotação USD/BRL 5,2"],
 "fontes":[{"titulo":"Anúncio A","url":"https://exemplo.com/a"}],"observacao":null}`;

describe("Parser da resposta da IA", () => {
  it("aceita JSON puro", () => {
    const r = interpretarResposta(bom);
    expect(r.valor_medio).toBe(520000);
    expect(r.fontes[0].url).toBe("https://exemplo.com/a");
  });
  it("tolera cercas de markdown e texto ao redor", () => {
    const r = interpretarResposta("Aqui está a estimativa:\n```json\n" + bom + "\n```\nEspero ter ajudado.");
    expect(r.valor_min).toBe(400000);
  });
  it("coage números vindos como string", () => {
    const r = interpretarResposta(bom.replace('"valor_medio":520000', '"valor_medio":"520000"'));
    expect(r.valor_medio).toBe(520000);
  });
  it("rejeita faixa inconsistente (min > médio)", () => {
    expect(() => interpretarResposta(bom.replace('"valor_min":400000', '"valor_min":600000'))).toThrow(/mínimo ≤ médio ≤ máximo/);
  });
  it("rejeita valor médio zero (IA não encontrou nada)", () => {
    const zero = bom.replace('"valor_min":400000', '"valor_min":0').replace('"valor_medio":520000', '"valor_medio":0').replace('"valor_max":700000', '"valor_max":0');
    expect(() => interpretarResposta(zero)).toThrow(/não encontrou/);
  });
  it("texto sem JSON continua sendo erro", () => {
    expect(() => extrairJson("sem json aqui")).toThrow(/não contém JSON/);
  });
  it("defeito de forma não derruba a estimativa: corta o que é longo, descarta o que é inválido", () => {
    const r = interpretarResposta(JSON.stringify({
      // 95 caracteres — antes esta unidade sozinha devolvia "String must contain at most 60 character(s)"
      unidade_ref: "unidade (barcaça graneleira de 2.000 t, usada, posta na bacia amazônica, com praça de máquinas)",
      valor_min: 400000, valor_medio: 520000, valor_max: 700000,
      confianca: "altíssima",
      premissas: ["Cotação de fevereiro", "   ", 42, "x".repeat(400)],
      fontes: [
        { titulo: "Anúncio A", url: "https://exemplo.com/a" },
        { titulo: "Mandado por WhatsApp", url: "nao-e-url" },
        { titulo: "", url: "https://exemplo.com/b" },
      ],
      observacao: "y".repeat(600),
    }));
    expect(r.valor_medio).toBe(520000);
    expect(r.unidade_ref).toHaveLength(80);
    expect(r.confianca).toBe("media");
    expect(r.premissas).toEqual(["Cotação de fevereiro", "x".repeat(300)]);
    expect(r.fontes.map((f) => f.url)).toEqual(["https://exemplo.com/a", "https://exemplo.com/b"]);
    expect(r.fontes[1].titulo).toBe("https://exemplo.com/b");
    expect(r.observacao).toHaveLength(500);
  });
  it("número inutilizável continua sendo erro, e traduzido", () => {
    const pt = obterDicionario("pt");
    const en = obterDicionario("en");
    expect(() => interpretarResposta('{"valor_min":"abc","valor_medio":1,"valor_max":2}', pt)).toThrow(pt.ia.semValor);
    expect(() => interpretarResposta('{"valor_medio":5}', pt)).toThrow(pt.ia.semValor);
    expect(() => interpretarResposta('{"valor_medio":5}', en)).toThrow(en.ia.semValor);
  });
  it("JSON malformado devolve a mensagem traduzida, não o SyntaxError em inglês", () => {
    expect(() => extrairJson('{"valor_min": 1, "valor_medio": }', "Sem JSON.")).toThrow("Sem JSON.");
  });
  it("junta os blocos de texto após a última busca (a API fatia o texto ao citar fontes)", () => {
    const content = [
      { type: "text", text: "Vou pesquisar preços de barcaças." },
      { type: "server_tool_use", name: "web_search" },
      { type: "web_search_tool_result" },
      { type: "text", text: "Achei duas fontes; refinando." },
      { type: "server_tool_use", name: "web_search" },
      { type: "web_search_tool_result" },
      { type: "text", text: '{"unidade_ref":"unidade","valor_min":400000,' },
      { type: "text", text: '"valor_medio":520000,"valor_max":700000,"confianca":"media",' },
      { type: "text", text: '"premissas":["Fonte X"],"fontes":[],"observacao":null}' },
    ];
    expect(interpretarResposta(textoFinal(content)).valor_medio).toBe(520000);
    // Sem busca nenhuma: usa todo o texto
    expect(textoFinal([{ type: "text", text: bom }])).toBe(bom);
    // JSON veio antes da última busca (modelo respondeu e ainda buscou): cai para o texto completo
    const cedo = [{ type: "text", text: bom }, { type: "server_tool_use" }, { type: "web_search_tool_result" }, { type: "text", text: "Confirmado." }];
    expect(interpretarResposta(textoFinal(cedo)).valor_min).toBe(400000);
  });
  it("aplica defaults para campos opcionais", () => {
    const r = interpretarResposta('{"valor_min":1,"valor_medio":2,"valor_max":3}');
    expect(r).toMatchObject({ unidade_ref: "unidade", confianca: "media", premissas: [], fontes: [], observacao: null });
  });
});

describe("Prompt", () => {
  it("inclui item, contexto, moeda e exige JSON", () => {
    const p = montarPrompt({ item: "Empurrador 1.200 HP", contexto: "usado", moeda: "BRL", nomeProjeto: "JV Norte", locale: "pt" });
    expect(p).toContain("Empurrador 1.200 HP");
    expect(p).toContain("usado");
    expect(p).toContain("BRL (R$)");
    expect(p).toContain("SOMENTE com um objeto JSON");
    expect(p).toContain("Brazilian Portuguese");
    expect(montarPrompt({ item: "x", moeda: "USD", nomeProjeto: "P", locale: "zh" })).toContain("Simplified Chinese");
  });
});

describe("Comparação com a média", () => {
  it("normaliza o item como a coluna item_normalizado do banco", () => {
    expect(normalizarItem("  Barcaça 2000T ")).toBe("barcaça 2000t");
  });
  it("calcula o desvio relativo e devolve null sem média", () => {
    expect(desvioVsMedia(598000, 520000)).toBe(0.15);
    expect(desvioVsMedia(468000, 520000)).toBe(-0.1);
    expect(desvioVsMedia(100, 0)).toBeNull();
  });
});

describe("Prompt da sugestão de custo", () => {
  const base = {
    descricao: "Operador de escavadeira", commodity: "Minério de ferro", moeda: "USD",
    unidadeProduto: "Toneladas", locale: "pt",
  } as const;

  it("pede a resposta na base do driver escolhido — é o que faz o número cair direto no campo", () => {
    expect(montarPromptCusto({ ...base, tipo: "cargo", driver: "por_mes", pais: "Bolívia" }))
      .toContain("o custo POR MÊS");
    expect(montarPromptCusto({ ...base, tipo: "servico", driver: "por_viagem", pais: null }))
      .toContain("o custo POR VIAGEM");
    // a base por unidade traz a unidade do produto da estimativa, não "tonelada" fixo
    expect(montarPromptCusto({ ...base, tipo: "servico", driver: "por_unidade", unidadeProduto: "m³" }))
      .toContain("UMA UNIDADE DE PRODUTO (m³)");
    expect(montarPromptCusto({ ...base, tipo: "servico", driver: "pct_receita" }))
      .toContain("percentual (0 a 100) aplicado sobre a receita");
  });

  it("cargo pergunta o custo do empregador e deixa o adicional noturno de fora da conta", () => {
    const p = montarPromptCusto({ ...base, tipo: "cargo", driver: "por_mes", pais: "Bolívia" });
    expect(p).toContain("Bolívia");
    expect(p).toContain("CUSTA PARA O EMPREGADOR");
    expect(p).toContain("encargos");
    // o sistema aplica o adicional noturno depois; somar aqui contaria duas vezes
    expect(p).toContain("Não some adicional noturno");
  });

  it("serviço não pergunta salário, e sem país o modelo é avisado em vez de chutar", () => {
    const p = montarPromptCusto({ ...base, descricao: "Frete rodoviário", tipo: "servico", driver: "por_viagem" });
    expect(p).toContain("Frete rodoviário");
    expect(p).not.toContain("CUSTA PARA O EMPREGADOR");
    expect(p).toContain("não informado");
  });

  it("a resposta sai no idioma do usuário e a etapa situa a busca", () => {
    const p = montarPromptCusto({ ...base, tipo: "servico", driver: "por_lote", etapa: "Porto Bush · Bolívia → Uruguai", locale: "zh" });
    expect(p).toContain("Porto Bush");
    expect(p).toContain("Simplified Chinese");
    expect(p).toContain("SOMENTE com um objeto JSON");
  });
});
