import { describe, it, expect, afterEach } from "vitest";
import { extrairJson, montarSchemaPost, gerarPost } from "../services/llm";

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

describe("gerarPost: exclusão de provedor", () => {
  // A cadeia só trocava de provedor em ERRO de API. Reprovação de conteúdo não
  // contava, então um provedor que respondia bem mas escrevia fontes erradas
  // consumia as 5 tentativas sozinho (incidente de 07/10/2026).
  const guardadas = { ...process.env };
  afterEach(() => {
    process.env = { ...guardadas };
  });

  it("falha avisando quando nenhum provedor tem chave", async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.GROQ_API_KEY;
    await expect(
      gerarPost({ system: "s", prompt: "p", schema: {} }),
    ).rejects.toThrow(/Nenhum provedor de IA configurado/);
  });

  it("não fica sem provedor quando o chamador exclui todos", async () => {
    // Só o Groq tem chave e ele está na lista de excluídos. Deve tentar mesmo
    // assim: um provedor que já reprovou é melhor que nenhum post.
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    process.env.GROQ_API_KEY = "chave-invalida-de-teste";
    process.env.GROQ_MODEL = "modelo-que-nao-existe";

    // Falha na CHAMADA (chave inválida), não por ficar sem provedor.
    await expect(
      gerarPost({ system: "s", prompt: "p", schema: {}, excluir: ["Groq"] }),
    ).rejects.toThrow(/Todos os provedores falharam/);
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
