import { describe, it, expect } from "vitest";
import { buildCommentary } from "../services/linkedin";
import { Post } from "../types";

function fakePost(overrides: Partial<Post> = {}): Post {
  return {
    id: "post-test123",
    title: "teste",
    date: new Date().toISOString(),
    excerpt: "teste",
    content: "teste",
    tags: ["a"],
    category: "Cloud",
    linkedinCaption: "Legenda de teste.",
    linkedinHashtags: ["Teste"],
    ...overrides,
  };
}

describe("buildCommentary", () => {
  it("inclui legenda, hashtags e link quando não há caracteres reservados", () => {
    const commentary = buildCommentary(fakePost());
    expect(commentary).toContain("Legenda de teste.");
    expect(commentary).toContain("#Teste");
    expect(commentary).toContain("https://leonardodebs.github.io/tech-insights-blog/posts/post-test123/");
  });

  it("escapa parênteses na legenda (regressão do bug de truncamento silencioso)", () => {
    // Reproduz exatamente o bug real: um parêntese literal na legenda fazia o
    // parser "little format" do LinkedIn cortar tudo depois dele, incluindo
    // hashtags e link, sem erro nenhum na resposta da API.
    const post = fakePost({
      linkedinCaption: "Implementar segregação de acesso granular (3-6 meses de refatoração).",
    });
    const commentary = buildCommentary(post);

    // Parênteses devem estar escapados com barra invertida
    expect(commentary).toContain("\\(3-6 meses de refatoração\\)");
    // E o mais importante: hashtags e link continuam presentes depois deles
    expect(commentary).toContain("#Teste");
    expect(commentary).toContain("https://leonardodebs.github.io/tech-insights-blog/posts/post-test123/");
  });

  it("escapa colchetes, chaves, arroba e demais caracteres reservados do little format", () => {
    const post = fakePost({
      linkedinCaption: "Referência [1], config {chave: valor}, @menção, <tag>, 50% * 2, snake_case, a~til, a|b, \\barra",
    });
    const commentary = buildCommentary(post);

    expect(commentary).toContain("\\[1\\]");
    expect(commentary).toContain("\\{chave: valor\\}");
    expect(commentary).toContain("\\@menção");
    expect(commentary).toContain("\\<tag\\>");
    expect(commentary).toContain("\\* 2");
    expect(commentary).toContain("snake\\_case");
    expect(commentary).toContain("a\\~til");
    expect(commentary).toContain("a\\|b");
    expect(commentary).toContain("\\\\barra");
  });

  it("não escapa as hashtags construídas por nós (precisam ficar clicáveis)", () => {
    const post = fakePost({ linkedinHashtags: ["CloudComputing", "DevOps"] });
    const commentary = buildCommentary(post);
    expect(commentary).toContain("#CloudComputing #DevOps");
    expect(commentary).not.toContain("\\#CloudComputing");
  });

  it("lança erro quando não há linkedinCaption", () => {
    const post = fakePost({ linkedinCaption: undefined });
    expect(() => buildCommentary(post)).toThrow();
  });
});
