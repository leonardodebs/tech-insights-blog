/**
 * Sanitização de HTML para o SSG (pré-renderização das páginas de post).
 *
 * Fecha o achado B-02: o generate-post-pages.ts injetava `marked.parse()` cru
 * no HTML estático, assumindo "conteúdo confiável". O conteúdo, porém, nasce de
 * fontes externas (RSS) processadas pelo Claude — uma injeção de prompt poderia
 * fazer um `<script>` ou `<img onerror>` chegar ao post e executar no HTML
 * estático, ANTES do React montar. Um admin (mesma origin, sessão em
 * localStorage) que visitasse a página teria a sessão roubada.
 *
 * Usa exatamente o MESMO rehype-sanitize do SPA (src/App.tsx), com o schema
 * padrão do rehype-sanitize. Assim o HTML estático e o renderizado pelo React
 * passam pela mesma política de segurança — não há duas superfícies divergentes.
 */
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

const processor = unified()
  // fragment: true trata a string como fragmento (sem <html>/<body> implícitos),
  // que é o caso do corpo do artigo vindo do marked.
  .use(rehypeParse, { fragment: true })
  .use(rehypeSanitize)
  .use(rehypeStringify);

/**
 * Recebe um HTML potencialmente perigoso e devolve a versão saneada, sem
 * <script>, sem handlers de evento (onerror, onclick, ...) e sem URLs
 * javascript:. Síncrono de propósito, para uso direto no script de build.
 */
export function sanitizeHtml(html: string): string {
  return processor.processSync(html).toString();
}
