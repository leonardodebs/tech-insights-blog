/**
 * Gera dist/rss.xml com os 20 posts mais recentes.
 * Executado após `vite build` no script "build" do package.json.
 */
import fs from "fs";
import path from "path";

const BASE_URL = "https://leonardodebs.github.io/tech-insights-blog";
const DIST_DIR = path.resolve(process.cwd(), "dist");
const POSTS_PATH = path.resolve(process.cwd(), "src/data/posts.json");

interface Post {
  id: string;
  title: string;
  date: string;
  excerpt: string;
  category: string;
  tags: string[];
}

const posts: Post[] = JSON.parse(fs.readFileSync(POSTS_PATH, "utf-8"));
const recent = posts.slice(0, 20);

const escapeXml = (str: string) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Tech Insights Blog</title>
    <link>${BASE_URL}/</link>
    <description>Curadoria técnica automatizada sobre Cloud, Linux, IA, Segurança, DevOps e Startups.</description>
    <language>pt-BR</language>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${recent
  .map(
    (p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${BASE_URL}/posts/${p.id}/</link>
      <guid isPermaLink="true">${BASE_URL}/posts/${p.id}/</guid>
      <description>${escapeXml(p.excerpt)}</description>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <category>${escapeXml(p.category)}</category>
    </item>`
  )
  .join("\n")}
  </channel>
</rss>`;

fs.writeFileSync(path.join(DIST_DIR, "rss.xml"), xml, "utf-8");
console.log(`✅ rss.xml gerado com ${recent.length} posts.`);
