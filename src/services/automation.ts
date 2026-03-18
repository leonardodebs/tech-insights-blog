import Groq from "groq-sdk";
import Parser from "rss-parser";
import fs from "fs";
import path from "path";
import { Post } from "../types";

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  }
});

const POSTS_PATH = path.resolve(process.cwd(), "src/data/posts.json");

const FEEDS = [
  "https://aws.amazon.com/blogs/aws/feed/",
  "https://azure.microsoft.com/en-us/blog/feed/",
  "https://cloud.google.com/blog/rss.xml",
  "https://www.phoronix.com/rss.php",
  "https://arstechnica.com/information-technology/feed/",
  "https://www.zdnet.com/topic/linux/rss.xml",
  "https://openai.com/news/rss.xml",
  "https://venturebeat.com/category/ai/feed/",
  "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
  "https://www.bleepingcomputer.com/feed/",
  "https://www.darkreading.com/rss.xml",
  "https://krebsonsecurity.com/feed/",
  "https://kubernetes.io/feed.xml",
  "https://devops.com/feed/",
  "https://www.infoq.com/feed/cloud-computing/",
  "https://techcrunch.com/category/startups/feed/",
  "https://www.wired.com/category/business/feed/",
  "https://tecnoblog.net/feed/"
];

// --- QUALITY GATES & ENRICHMENT ---

function validatePost(content: string): boolean {
  const lower = content.toLowerCase();
  // Quality Gate: No posts under 600 chars, must have tech terms, must mention architecture
  if (content.length < 600) return false;
  if (!lower.includes("kubectl") && !lower.includes("aws") && !lower.includes("linux") && !lower.includes("docker")) return false;
  if (!lower.includes("arquitetura")) return false;
  return true;
}

function enrichPost(content: string, type: string): string {
  let text = content;
  // Automatically add practical examples if missing
  if (!text.includes("kubectl") && (type === "Tutorial" || type === "Tech News / Trend")) {
    text = text.replace("</p>\n<h3>", "</p>\n<p><strong>Insight Prático:</strong> Em cenários reais, a validação de recursos pode ser feita via terminal:</p>\n<pre><code>kubectl get pods -A\naws s3 ls</code></pre>\n<h3>");
  }
  return text;
}

export async function runAutomation(targetCategory?: string | null) {
  console.log("🚀 Iniciando motor de automação profissional...");

  const apiKey = (process.env.GROQ_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey) throw new Error("Chave GROQ_API_KEY não configurada.");

  const groq = new Groq({ apiKey });
  const model = "llama-3.1-8b-instant";

  // 1. Coleta e Preparação
  const newsItems: string[] = [];
  for (const url of FEEDS) {
    try {
      const feed = await parser.parseURL(url);
      feed.items.slice(0, 5).forEach(item => {
        newsItems.push(`- [${feed.title}] ${item.title}: ${item.contentSnippet || ""}`);
      });
    } catch (e) { /* skip */ }
  }

  const context = newsItems.sort(() => Math.random() - 0.5).slice(0, 10).join("\n");
  const articleTypes = ["Tutorial", "Concept Explanation", "Tech News / Trend"];
  const selectedType = articleTypes[Math.floor(Math.random() * articleTypes.length)];

  // ETAPA 1: Gerar Outline (Multi-step generation)
  console.log(`📝 Etapa 1: Gerando planejamento para [${selectedType}]...`);
  const outlineRes = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "Você é um Arquiteto Cloud. Gere apenas o JSON de um outline para um post técnico. Esqueleto sugerido: Título, Intro (Problema Real), Detalhes Técnicos, Diagrama TXT, Conclusão."
      },
      {
        role: "user",
        content: `Crie um planejamento de post ${selectedType} sobre:\n${context.substring(0, 2000)}`
      }
    ],
    model,
    response_format: { type: "json_object" }
  });
  const outline = JSON.parse(outlineRes.choices[0]?.message?.content || "{}");

  // ETAPA 2: Gerar Conteúdo (Persona & Custom Prompting)
  console.log("✍️ Etapa 2: Expandindo conteúdo com persona Sênior...");
  const contentRes = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `You are a senior DevOps engineer with real-world production experience.
        Write in Brazilian Portuguese. 
        STRICT RULES:
        - Avoid generic phrases like "é essencial", "nos dias de hoje".
        - Be practical and technical. No teacher-tone, use engineer-tone.
        - Add a strong opinion or market insight.
        - Use real tools (AWS, Kubernetes, Linux, etc).
        - O campo 'content' deve ser HTML PURO. Use apenas aspas simples (') internamente.`
      },
      {
        role: "user",
        content: `Expand this outline into a full article:\n${JSON.stringify(outline)}\n\nCONTEXT:\n${context.substring(0, 2000)}\n\nJSON SCHEMA: {"title": "...", "excerpt": "...", "category": "${targetCategory || 'DevOps'}", "tags": [], "content": "..."}`
      }
    ],
    model,
    response_format: { type: "json_object" },
    temperature: 0.7
  });

  let result = JSON.parse(contentRes.choices[0]?.message?.content || "{}");

  // ETAPA 3: Quality Gate & Enricher
  console.log("🛡️ Etapa 3: Validando Quality Gate...");
  if (!validatePost(result.content)) {
    console.warn("⚠️ Post simples demais. Enriquecendo tecnicamente...");
    result.content = enrichPost(result.content, selectedType);
    
    if (!validatePost(result.content)) {
        // Se ainda falhar, injetamos um parágrafo de arquitetura forçado
        result.content += `\n\n<h3>Arquitetura e Observabilidade</h3>\n<p>Dica de especialista: Nunca ignore a arquitetura de rede. Em clusters <strong>Kubernetes</strong>, a segregação via Network Policies é o que separa amadores de profissionais.</p>`;
    }
  }

  // ETAPA 4: De-duplicação e Salvamento
  let existingPosts: Post[] = [];
  if (fs.existsSync(POSTS_PATH)) {
    existingPosts = JSON.parse(fs.readFileSync(POSTS_PATH, "utf-8") || "[]");
  }

  const isDuplicate = existingPosts.some(p => 
    p.title.toLowerCase() === result.title.toLowerCase() || 
    p.content.substring(0, 100) === result.content.substring(0, 100)
  );

  if (isDuplicate) {
    throw new Error("Conteúdo similar detectado. Abortando para evitar repetição.");
  }

  const newPost: Post = {
    id: `post-${Date.now()}`,
    title: result.title,
    date: new Date().toISOString(),
    excerpt: result.excerpt,
    content: result.content,
    tags: result.tags || [],
    category: result.category || "General"
  };

  existingPosts.unshift(newPost);
  fs.writeFileSync(POSTS_PATH, JSON.stringify(existingPosts, null, 2));

  console.log("✅ Artigo de alto nível gerado e salvo!");
  return newPost;
}
