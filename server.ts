import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { runAutomation } from "./src/services/automation.ts";
import path from "path";
import fs from "fs/promises";
import helmet from "helmet";
import compression from "compression";
import he from "he";
import crypto from "crypto";

/** URL pública do site, usada para montar links canônicos sem refletir o Host. */
const BASE_URL = "https://leonardodebs.github.io/tech-insights-blog";

/**
 * Compara o token em tempo constante (achado A-07). O `!==` interrompe na
 * primeira diferença, o que em tese permite inferir o valor medindo o tempo de
 * resposta. Compara o hash de ambos para que os buffers tenham sempre o mesmo
 * tamanho, condição exigida por timingSafeEqual.
 */
function tokensIguais(recebido: string | undefined, esperado: string): boolean {
  if (!recebido) return false;
  const a = crypto.createHash("sha256").update(recebido).digest();
  const b = crypto.createHash("sha256").update(esperado).digest();
  return crypto.timingSafeEqual(a, b);
}

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
    // Guarda fail-closed (B-05). Este endpoint dispara a geração de post, que
    // usa SUPABASE_SERVICE_ROLE_KEY e ANTHROPIC_API_KEY. Sem auth, quem
    // alcançasse o servidor geraria posts e queimaria a cota da Anthropic.
    // O servidor é só de desenvolvimento (npm run dev), mas a guarda garante
    // que, mesmo se algum dia for publicado, o endpoint não fique aberto:
    // exige um token que só existe na máquina local; se não configurado, NEGA.
    const expected = process.env.LOCAL_AUTOMATION_TOKEN;
    if (!expected || !tokensIguais(req.get("x-automation-token"), expected)) {
      return res.status(401).json({
        success: false,
        error: "Não autorizado. Defina LOCAL_AUTOMATION_TOKEN e envie o header x-automation-token.",
      });
    }

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
      // O stack fica SÓ no log do servidor (achado A-04). Antes ele voltava no
      // corpo da resposta sempre que NODE_ENV não fosse exatamente 'production',
      // expondo caminhos absolutos e a estrutura do projeto a quem chamasse.
      console.error("Automation trigger failed:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Unknown error during automation",
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

        // URL canônica montada a partir de uma constante do servidor, NUNCA do
        // cabeçalho Host nem de req.originalUrl (achado A-02). Ambos são
        // controlados por quem faz a requisição e iam crus para dentro de um
        // atributo HTML, permitindo escapar do content com uma aspa e injetar
        // script. Escapada também, por defesa em profundidade.
        const safeUrl = he.encode(`${BASE_URL}/posts/${post.id}/`);

        // Inject meta tags
        html = html.replace(/<title>.*?<\/title>/, `<title>${safeTitle} | Tech Insights</title>`);
        html = html.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${safeExcerpt}" />`);
        html = html.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${safeTitle}" />`);
        html = html.replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${safeExcerpt}" />`);
        html = html.replace(/<meta property="og:url" content=".*?" \/>/, `<meta property="og:url" content="${safeUrl}" />`);
        html = html.replace(/<meta property="twitter:title" content=".*?" \/>/, `<meta property="twitter:title" content="${safeTitle}" />`);
        html = html.replace(/<meta property="twitter:description" content=".*?" \/>/, `<meta property="twitter:description" content="${safeExcerpt}" />`);
        html = html.replace(/<meta property="twitter:url" content=".*?" \/>/, `<meta property="twitter:url" content="${safeUrl}" />`);
        
        // Imagem de marca própria, a mesma da produção (achado A-06). O
        // picsum.photos foi removido do site publicado por entregar o IP do
        // visitante a um terceiro; o dev server tinha ficado para trás.
        const imageUrl = `${BASE_URL}/og/default.png`;
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

  // Loopback, não 0.0.0.0 (achado A-03): este processo carrega a service_role
  // e a chave da Anthropic no ambiente, e não deve ficar exposto à rede local.
  app.listen(PORT, "127.0.0.1", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
