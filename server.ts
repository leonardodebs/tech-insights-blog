import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { runAutomation } from "./src/services/automation.ts";
import path from "path";
import fs from "fs/promises";
import helmet from "helmet";
import compression from "compression";
import he from "he";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for development with Vite
  }));

  // Compression
  app.use(compression());

  app.use(express.json());

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // Simple in-memory rate limit for automation
  const automationRateLimit = new Map<string, number>();
  const COOLDOWN_MS = 60 * 1000; // 1 minute

  // API Route to trigger automation (for testing in preview)
  app.post("/api/trigger-automation", async (req, res) => {
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'anonymous';
    const lastTrigger = automationRateLimit.get(ip);
    
    if (lastTrigger && Date.now() - lastTrigger < COOLDOWN_MS) {
      const waitTime = Math.ceil((COOLDOWN_MS - (Date.now() - lastTrigger)) / 1000);
      return res.status(429).json({ 
        success: false, 
        error: `Muitas solicitações. Aguarde ${waitTime} segundos para gerar outro post.` 
      });
    }

    try {
      const { category } = req.body;
      const newPost = await runAutomation(category);
      automationRateLimit.set(ip, Date.now());
      res.json({ success: true, post: newPost });
    } catch (error: any) {
      console.error("Automation trigger failed:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Unknown error during automation",
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      });
    }
  });

  // API Route to get posts
  app.get("/api/posts", async (req, res) => {
    const postsPath = path.resolve(process.cwd(), "src/data/posts.json");
    try {
      const data = await fs.readFile(postsPath, "utf-8");
      const posts = JSON.parse(data);
      res.json(posts);
    } catch (error) {
      console.error("Error reading posts.json:", error);
      res.json([]);
    }
  });

  // Middleware to inject meta tags for social sharing
  app.get("/", async (req, res, next) => {
    const postId = req.query.post as string;
    if (!postId) return next();

    try {
      const postsPath = path.resolve(process.cwd(), "src/data/posts.json");
      const data = await fs.readFile(postsPath, "utf-8");
      const posts = JSON.parse(data);
      const post = posts.find((p: any) => p.id === postId);

      if (post) {
        let indexPath = path.resolve(process.cwd(), process.env.NODE_ENV === "production" ? "dist/index.html" : "index.html");
        let html = await fs.readFile(indexPath, "utf-8");

        // Sanitize data for injection
        const safeTitle = he.encode(post.title);
        const safeExcerpt = he.encode(post.excerpt);

        // Inject meta tags
        html = html.replace(/<title>.*?<\/title>/, `<title>${safeTitle} | Tech Insights</title>`);
        html = html.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${safeExcerpt}" />`);
        html = html.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${safeTitle}" />`);
        html = html.replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${safeExcerpt}" />`);
        html = html.replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}" />`);
        html = html.replace(/<meta property="twitter:title" content=".*?" \/>/, `<meta property="twitter:title" content="${safeTitle}" />`);
        html = html.replace(/<meta property="twitter:description" content=".*?" \/>/, `<meta property="twitter:description" content="${safeExcerpt}" />`);
        html = html.replace(/<meta property="twitter:url" content=".*?" \/>/, `<meta property="twitter:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}" />`);
        
        // Add a specific image for the post if possible, or use a seeded one
        const imageUrl = `https://picsum.photos/seed/${post.id}/1200/630`;
        html = html.replace(/<meta property="og:image" content=".*?" \/>/, `<meta property="og:image" content="${imageUrl}" />`);
        html = html.replace(/<meta property="twitter:image" content=".*?" \/>/, `<meta property="twitter:image" content="${imageUrl}" />`);

        return res.send(html);
      }
    } catch (error) {
      console.error("Error injecting meta tags:", error);
    }
    next();
  });

  console.log(`Server starting in ${process.env.NODE_ENV || 'development'} mode`);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(process.cwd(), "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
