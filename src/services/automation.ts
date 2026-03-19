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

// --- QUALITY GATES ---

function validatePost(content: string): boolean {
  const lower = content.toLowerCase();
  // Quality Gate: No posts under 600 chars, must have tech terms
  if (content.length < 600) return false;
  const techTerms = ["aws", "cloud", "linux", "security", "devops", "kubernetes", "docker", "ia", "ai", "observability"];
  return techTerms.some(term => lower.includes(term));
}

export async function runAutomation(targetCategory?: string | null) {
  console.log("🚀 Iniciando motor de automação sênior...");

  const apiKey = (process.env.GROQ_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey) throw new Error("Chave GROQ_API_KEY não configurada.");

  const groq = new Groq({ apiKey });
  const model = "llama-3.3-70b-versatile";

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
  const articleTypes = ["INSIGHT (opinião técnica)", "PRÁTICO (guia aplicado)", "NOTÍCIA + ANÁLISE"];
  const selectedType = articleTypes[Math.floor(Math.random() * articleTypes.length)];

  // ETAPA 1: Gerar Outline Técnico
  console.log(`📝 Etapa 1: Gerando planejamento para [${selectedType}]...`);
  const outlineRes = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `Você é um Arquiteto Cloud Sênior. Gere APENAS um objeto JSON de planejamento para um artigo do tipo ${selectedType}.
        ESTRUTURA OBRIGATÓRIA: Título forte, Resumo direto, Intro, Seção 1 (Problema Real), Seção 2 (Explicação Objetiva), Seção 3 (Análise Prática), Seção 4 (Erros Comuns/Trade-offs), Seção 5 (Cenário Real), Conclusão Direta.
        NUNCA use frases genéricas de IA.`
      },
      {
        role: "user",
        content: `Planejamento técnico sobre:\n${context.substring(0, 2000)}`
      }
    ],
    model,
    response_format: { type: "json_object" }
  });
  const outline = JSON.parse(outlineRes.choices[0]?.message?.content || "{}");

  // ETAPA 2: Gerar Conteúdo Sênior
  console.log("✍️ Etapa 2: Expandindo conteúdo com persona Especialista...");
  const contentRes = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `Você é um especialista sênior em Cloud, DevOps, Kubernetes, Linux e Segurança. Escreva em PT-BR.
        DIRETRIZES CRÍTICAS:
        - Estilo: Direto, técnico, sem enrolação. Linguagem de quem trabalha na área.
        - PROIBIDO: "neste artigo você vai aprender", "em resumo", "é importante destacar", "nos dias de hoje".
        - OBRIGATÓRIO: Texto de 600-900 palavras. Inclua opinião técnica, cenário real e 1 crítica ou limitação.
        - FORMATO: JSON com campo 'content' em HTML semântico. NUNCA use concatenação (+).`
      },
      {
        role: "user",
        content: `Expanda este planejamento:\n${JSON.stringify(outline)}\n\nCONTEXTO:\n${context.substring(0, 2000)}\n\nJSON SCHEMA: {"title": "...", "excerpt": "...", "category": "${targetCategory || 'Cloud'}", "tags": [], "content": "..."}`
      }
    ],
    model,
    response_format: { type: "json_object" },
    temperature: 0.6
  });

  let rawContent = contentRes.choices[0]?.message?.content || "{}";
  rawContent = rawContent.replace(/"\s*\+\s*"/g, ""); // Limpeza de concatenação Hallucinated JS
  let result = JSON.parse(rawContent);

  // ETAPA 3: Quality Gate
  console.log("🛡️ Etapa 3: Validando Quality Gate...");
  if (!validatePost(result.content)) {
    throw new Error("O post gerado não atingiu os critérios mínimos de qualidade técnica.");
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
