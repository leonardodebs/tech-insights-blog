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

function validatePost(content: string): boolean {
  const lower = content.toLowerCase();
  if (content.length < 500) return false;
  const techTerms = ["aws", "cloud", "linux", "security", "devops", "kubernetes", "docker", "ia", "ai", "observability"];
  return techTerms.some(term => lower.includes(term));
}

export async function runAutomation(targetCategory?: string | null) {
  console.log("🚀 Iniciando motor de automação sênior (v3)...");

  const apiKey = (process.env.GROQ_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey) throw new Error("Chave GROQ_API_KEY não configurada.");

  const groq = new Groq({ apiKey });
  const model = "llama-3.3-70b-versatile";

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
  const articleTypes = ["INSIGHT", "PRÁTICO", "NOTÍCIA + ANÁLISE"];
  const selectedType = articleTypes[Math.floor(Math.random() * articleTypes.length)];

  console.log(`📝 Etapa 1: Planejamento [${selectedType}]...`);
  const outlineRes = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `Você é um Arquiteto Cloud Sênior. Gere um JSON de planejamento para um post do tipo ${selectedType}. 
        Seções: Intro, Problema, Explicação, Análise, Trade-offs, Caso Real, Conclusão.`
      },
      {
        role: "user",
        content: `Crie o outline sobre:\n${context.substring(0, 2000)}`
      }
    ],
    model,
    response_format: { type: "json_object" }
  });
  const outline = JSON.parse(outlineRes.choices[0]?.message?.content || "{}");

  console.log("✍️ Etapa 2: Gerando conteúdo de Autoridade Sênior...");
  const contentRes = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `Você é um Engenheiro Sênior Especialista em Cloud, Segurança, Kubernetes e IA. Escreva em PT-BR (Brasil).

⚠️ REGRAS CRÍTICAS:
- NUNCA escreva como IA genérica. Sem enrolação.
- NÃO explique o óbvio. Foque em nível de PRODUÇÃO.
- PROIBIDO: "neste artigo", "em resumo", "importante destacar", "escalabilidade", "eficiência" (sem aprofundar).
- ESTILO: Direto, analítico, crítico e sem enrolação.

📌 ESTRUTURA OBRIGATÓRIA (MARKDOWN):
- TÍTULO (Forte e técnico)
- RESUMO (2 linhas diretas)
- INTRODUÇÃO (Começa direto no problema real de produção)
- SEÇÃO 1: O QUE ESTÁ REALMENTE ACONTECENDO (Contexto real do mercado/técnico)
- SEÇÃO 2: ONDE ESTÁ O RISCO DE VERDADE (Explicação profunda do problema)
- SEÇÃO 3: O QUE A MAIORIA FAZ ERRADO (Diferencial técnico/crítico)
- SEÇÃO 4: COMO ISSO FUNCIONA NA PRÁTICA (Arquitetura, decisão, visão real)
- SEÇÃO 5: TRADE-OFFS E LIMITAÇÕES (Quando NÃO usar, riscos reais)
- CONCLUSÃO (Opinião direta do engenheiro, sem frases motivacionais)

🔥 DIFERENCIAIS: Inclua pelo menos 1 crítica técnica ácida e 1 insight pouco óbvio.
📌 TAMANHO: 600 a 900 palavras.
📌 FORMATO: JSON. O campo 'content' deve conter o MARKDOWN puro do artigo.`
      },
      {
        role: "user",
        content: `Gere um post técnico de ELITE baseado neste outline:\n${JSON.stringify(outline)}\n\nCONTEXTO:\n${context.substring(0, 2000)}\n\nJSON SCHEMA: {"title": "...", "excerpt": "...", "category": "Cloud", "tags": [], "content": "..."}`
      }
    ],
    model,
    response_format: { type: "json_object" },
    temperature: 0.6
  });

  let rawContent = contentRes.choices[0]?.message?.content || "{}";
  // Limpeza de segurança para evitar backticks indesejados no JSON
  rawContent = rawContent.replace(/```markdown|```html|```json|```/g, "");
  
  let result = JSON.parse(rawContent);

  console.log("🛡️ Etapa 3: Validação...");
  if (!validatePost(result.content)) {
    throw new Error("Post reprovado pelo Quality Gate técnico.");
  }

  let existingPosts: Post[] = [];
  if (fs.existsSync(POSTS_PATH)) {
    existingPosts = JSON.parse(fs.readFileSync(POSTS_PATH, "utf-8") || "[]");
  }

  const isDuplicate = existingPosts.some(p => 
    p.title.toLowerCase() === result.title.toLowerCase() || 
    p.content.substring(0, 100) === result.content.substring(0, 100)
  );

  if (isDuplicate) throw new Error("Conteúdo duplicado.");

  const newPost: Post = {
    id: `post-${Date.now()}`,
    title: result.title,
    date: new Date().toISOString(),
    excerpt: result.excerpt,
    content: result.content,
    tags: result.tags || [],
    category: result.category || "Cloud"
  };

  existingPosts.unshift(newPost);
  fs.writeFileSync(POSTS_PATH, JSON.stringify(existingPosts, null, 2));

  console.log("✅ Artigo gerado com sucesso!");
  return newPost;
}
