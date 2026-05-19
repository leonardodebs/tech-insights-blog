/**
 * Gera dist/sitemap.xml com todos os posts do posts.json.
 * Executado após `vite build` no script "build" do package.json.
 */
import fs from "fs";
import path from "path";

const BASE_URL = "https://leonardodebs.github.io/tech-insights-blog";
const DIST_DIR = path.resolve(process.cwd(), "dist");
const POSTS_PATH = path.resolve(process.cwd(), "src/data/posts.json");

interface Post {
  id: string;
  date: string;
}

const posts: Post[] = JSON.parse(fs.readFileSync(POSTS_PATH, "utf-8"));

const staticUrls = [
  { loc: `${BASE_URL}/`, priority: "1.0", changefreq: "daily", lastmod: "" },
];

const postUrls = posts.map((p) => ({
  loc: `${BASE_URL}/posts/${p.id}/`,
  lastmod: new Date(p.date).toISOString().split("T")[0],
  priority: "0.8",
  changefreq: "weekly",
}));

const allUrls = [...staticUrls, ...postUrls];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

fs.writeFileSync(path.join(DIST_DIR, "sitemap.xml"), xml, "utf-8");
console.log(`✅ sitemap.xml gerado com ${allUrls.length} URLs.`);
