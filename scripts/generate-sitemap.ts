import fs from "fs";
import path from "path";

const SITE_URL = "https://leonardodebs.github.io/tech-insights-blog";
const POSTS_PATH = path.resolve(process.cwd(), "src/data/posts.json");
const DIST_PATH = path.resolve(process.cwd(), "dist");

const posts = JSON.parse(fs.readFileSync(POSTS_PATH, "utf-8"));

const staticPages = [
  { url: "/", priority: "1.0", changefreq: "daily" },
  { url: "/admin", priority: "0.1", changefreq: "never" },
];

const postEntries = posts.map((post: any) => ({
  url: `/posts/${post.id}/`,
  lastmod: post.date.split("T")[0],
  priority: "0.8",
  changefreq: "weekly",
}));

const allEntries = [...staticPages, ...postEntries];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allEntries.map(e => `  <url>
    <loc>${SITE_URL}${e.url}</loc>
    ${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

fs.writeFileSync(path.join(DIST_PATH, "sitemap.xml"), sitemap);
console.log(`✅ sitemap.xml gerado com ${allEntries.length} URLs.`);
