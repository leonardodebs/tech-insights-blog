import { describe, it, expect } from "vitest";
import { stripLeadingTitleAndSummary } from "../lib/postContent";

describe("stripLeadingTitleAndSummary", () => {
  it("remove título (# ...) e resumo (> ...) do início", () => {
    const content = `# Título do Post
> Resumo em uma linha de tese.

## O que está acontecendo
Corpo do artigo.`;
    const result = stripLeadingTitleAndSummary(content);
    expect(result).toBe("## O que está acontecendo\nCorpo do artigo.");
    expect(result).not.toContain("# Título do Post");
    expect(result).not.toContain("> Resumo");
  });

  it("remove blockquote de resumo com múltiplas linhas", () => {
    const content = `# Título
> Linha um do resumo.
> Linha dois do resumo.

## Seção`;
    expect(stripLeadingTitleAndSummary(content)).toBe("## Seção");
  });

  it("lida com linhas em branco antes do título", () => {
    const content = `

# Título

> Resumo.

## Seção`;
    expect(stripLeadingTitleAndSummary(content)).toBe("## Seção");
  });

  it("preserva content que não começa com título nem resumo", () => {
    const content = `## Seção direta
Sem título nem resumo no topo.`;
    expect(stripLeadingTitleAndSummary(content)).toBe(content);
  });

  it("remove só o título quando não há resumo", () => {
    const content = `# Título
## Seção`;
    expect(stripLeadingTitleAndSummary(content)).toBe("## Seção");
  });

  it("não confunde ## (h2) com # (h1) no início", () => {
    const content = `## Não é título de nível 1
Corpo.`;
    expect(stripLeadingTitleAndSummary(content)).toBe(content);
  });

  it("retorna string vazia para content vazio", () => {
    expect(stripLeadingTitleAndSummary("")).toBe("");
  });
});
