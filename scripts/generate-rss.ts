import fs from "fs";
import path from "path";

const SITE_URL = "https://leonardodebs.github.io/tech-insights-blog";
const BLOG_TITLE = "Tech Insights";
const BLOG_DESCRIPTION = "Curadoria automatizada sobre Cloud, Linux, IA, Segurança, DevOps e Startups.";
const POSTS_PATH = path.resolve(process.cwd(), "src/data/posts.json");
const DIST_PATH = path.resolve(process.cwd(), "dist");

const posts = JSON.parse(fs.readFileSync(POSTS_PATH, "utf-8"));
const recent = posts.slice(0, 20);

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const items = recent.map((post: any) => `  <item>
    <title>${escapeXml(post.title)}</title>
    <link>${SITE_URL}/posts/${post.id}/</link>
    <guid isPermaLink="true">${SITE_URL}/posts/${post.id}/</guid>
    <pubDate>${new Date(post.date).toUTCString()}</pubDate>
    <description>${escapeXml(post.excerpt)}</description>
    <category>${escapeXml(post.category)}</category>
    ${post.tags.map((t: string) => `<category>${escapeXml(t)}</category>`).join("\n    ")}
  </item>`).join("\n");

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${BLOG_TITLE}</title>
    <link>${SITE_URL}</link>
    <description>${BLOG_DESCRIPTION}</description>
    <language>pt-BR</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

fs.writeFileSync(path.join(DIST_PATH, "feed.xml"), rss);
console.log(`✅ feed.xml gerado com ${recent.length} posts.`);
