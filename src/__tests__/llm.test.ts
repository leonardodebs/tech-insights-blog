import { describe, it, expect } from "vitest";
import { extrairJson, montarSchemaPost } from "../services/llm";

/**
 * O parser de JSON é o ponto frágil da troca de provedor: o Gemini devolve JSON
 * limpo por causa do response_format, mas os provedores compatíveis com OpenAI
 * (Groq, OpenRouter) frequentemente embrulham a resposta em cerca de markdown
 * mesmo em modo JSON. Se isso quebrar, nenhum post é gerado.
 */
describe("extrairJson", () => {
  const objeto = {
    title: "Título",
    excerpt: "Resumo",
    category: "DevOps",
    tags: ["a", "b"],
    content: "# Conteúdo",
    linkedinCaption: "Legenda",
    linkedinHashtags: ["Kubernetes"],
  };

  it("lê JSON puro", () => {
    expect(extrairJson(JSON.stringify(objeto))).toEqual(objeto);
  });

  it("lê JSON embrulhado em cerca ```json", () => {
    expect(extrairJson("```json\n" + JSON.stringify(objeto) + "\n```")).toEqual(objeto);
  });

  it("lê JSON embrulhado em cerca simples", () => {
    expect(extrairJson("```\n" + JSON.stringify(objeto) + "\n```")).toEqual(objeto);
  });

  it("ignora texto de conversa antes e depois do objeto", () => {
    const sujo = `Claro! Aqui está o post:\n${JSON.stringify(objeto)}\nEspero que ajude.`;
    expect(extrairJson(sujo)).toEqual(objeto);
  });

  it("preserva chaves dentro de strings do conteúdo", () => {
    const comChaves = { ...objeto, content: "Use ${VAR} e { chave: valor } no código." };
    expect(extrairJson(JSON.stringify(comChaves)).content).toBe(comChaves.content);
  });

  it("falha de forma explícita quando não há objeto JSON", () => {
    expect(() => extrairJson("Desculpe, não consigo gerar isso.")).toThrow(/não contém um objeto JSON/);
  });
});

describe("montarSchemaPost", () => {
  it("trava a categoria no valor pedido, impedindo o modelo de escolher outra", () => {
    const s = montarSchemaPost("Security") as any;
    expect(s.properties.category.enum).toEqual(["Security"]);
  });

  it("exige todos os campos que o post precisa para ser publicado", () => {
    const s = montarSchemaPost("Cloud") as any;
    expect(s.required).toEqual([
      "title", "excerpt", "category", "tags",
      "content", "linkedinCaption", "linkedinHashtags",
    ]);
  });

  it("declara os campos de lista como array de string", () => {
    const s = montarSchemaPost("AI") as any;
    expect(s.properties.tags.type).toBe("array");
    expect(s.properties.tags.items.type).toBe("string");
    expect(s.properties.linkedinHashtags.items.type).toBe("string");
  });
});
