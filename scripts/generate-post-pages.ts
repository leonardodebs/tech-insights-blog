import fs from "fs";
import path from "path";

const SITE_URL = "https://leonardodebs.github.io/tech-insights-blog";
const POSTS_PATH = path.resolve(process.cwd(), "src/data/posts.json");
const DIST_PATH = path.resolve(process.cwd(), "dist");
const INDEX_PATH = path.join(DIST_PATH, "index.html");

const posts = JSON.parse(fs.readFileSync(POSTS_PATH, "utf-8"));
const baseHtml = fs.readFileSync(INDEX_PATH, "utf-8");

function escapeAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

let generated = 0;
for (const post of posts) {
  const postDir = path.join(DIST_PATH, "posts", post.id);
  fs.mkdirSync(postDir, { recursive: true });

  const postUrl = `${SITE_URL}/posts/${post.id}/`;
  const imageUrl = `https://picsum.photos/seed/${post.id}/1200/630`;
  const safeTitle = escapeAttr(post.title);
  const safeExcerpt = escapeAttr(post.excerpt);

  let html = baseHtml;

  // Title
  html = html.replace(/<title>.*?<\/title>/, `<title>${safeTitle} | Tech Insights</title>`);

  // Canonical
  html = html.replace(
    /<link rel="canonical" href=".*?" \/>/,
    `<link rel="canonical" href="${postUrl}" />`
  );

  // Description
  html = html.replace(
    /<meta name="description" content=".*?" \/>/,
    `<meta name="description" content="${safeExcerpt}" />`
  );

  // OG tags
  html = html.replace(/<meta property="og:type" content=".*?" \/>/, `<meta property="og:type" content="article" />`);
  html = html.replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${postUrl}" />`);
  html = html.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${safeTitle}" />`);
  html = html.replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${safeExcerpt}" />`);
  html = html.replace(/<meta property="og:image" content=".*?" \/>/, `<meta property="og:image" content="${imageUrl}" />`);

  // Twitter tags
  html = html.replace(/<meta property="twitter:url" content=".*?" \/>/, `<meta property="twitter:url" content="${postUrl}" />`);
  html = html.replace(/<meta property="twitter:title" content=".*?" \/>/, `<meta property="twitter:title" content="${safeTitle}" />`);
  html = html.replace(/<meta property="twitter:description" content=".*?" \/>/, `<meta property="twitter:description" content="${safeExcerpt}" />`);
  html = html.replace(/<meta property="twitter:image" content=".*?" \/>/, `<meta property="twitter:image" content="${imageUrl}" />`);

  // Inject script to auto-open the correct post in the SPA
  const postScript = `<script>window.__INITIAL_POST_ID__="${post.id}";</script>`;
  html = html.replace("</head>", `${postScript}\n</head>`);

  fs.writeFileSync(path.join(postDir, "index.html"), html);
  generated++;
}

console.log(`✅ ${generated} páginas estáticas de posts geradas em dist/posts/`);
