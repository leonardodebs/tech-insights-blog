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
  console.log("🚀 Iniciando motor de automação de notícias sênior (v4)...");

  const apiKey = (process.env.GROQ_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey) throw new Error("Chave GROQ_API_KEY não configurada.");

  const groq = new Groq({ apiKey });
  const model = "llama-3.3-70b-versatile";

  let existingPosts: Post[] = [];
  if (fs.existsSync(POSTS_PATH)) {
    existingPosts = JSON.parse(fs.readFileSync(POSTS_PATH, "utf-8") || "[]");
  }

  const recentThemes = existingPosts.slice(0, 5).map(p => p.title).join(", ");

  const newsItems: string[] = [];
  for (const url of FEEDS) {
    try {
      const feed = await parser.parseURL(url);
      feed.items.slice(0, 5).forEach(item => {
        newsItems.push(`- [Fonte: ${feed.title}] ${item.title}: ${item.contentSnippet || ""}`);
      });
    } catch (e) { /* skip */ }
  }

  const context = newsItems.sort(() => Math.random() - 0.5).slice(0, 12).join("\n");

  console.log("✍️ Etapa 1: Gerando Análise de Notícias de Elite...");
  const contentRes = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `Você é um Engenheiro Sênior escrevendo um artigo baseado em notícias recentes.

IMPORTANTE:
- Este NÃO é um tutorial. É uma análise baseada em fatos recentes.
- Objetivo: Transformar múltiplas notícias em um único artigo com curadoria, análise técnica e insight real.

REGRAS CRÍTICAS:
1. NÃO resumir notícia por notícia. Conecte tudo em uma narrativa única. Foco em UM problema ou tendência.
2. Linguagem direta, técnica e sem enrolação. PROIBIDO conteúdo genérico.
3. Comece com IMPACTO: um problema real, falha comum ou risco emergente.

📌 ESTRUTURA OBRIGATÓRIA (MARKDOWN):
# [TÍTULO IMPACTANTE]
> Resumo (2 linhas diretas)

## O que está acontecendo de verdade
(Conectar as notícias)

## Por que isso importa agora
(Contexto técnico)

## Onde está o risco ou oportunidade
(Insight técnico profundo)

## O que muda na prática
(Decisão técnica/Arquitetura)

## Trade-offs

## Conclusão direta

## Fontes
(Lista simples das notícias usadas)

⚠️ REGRAS DE QUALIDADE:
- Máximo 600 palavras.
- Sem repetir temas recentes: ${recentThemes}
- Se o tema for parecido, escolha outro ângulo ou aprofunde um aspecto diferente.
- FORMATO: JSON com campos 'title', 'excerpt', 'category', 'tags' e 'content' (Markdown).`
      },
      {
        role: "user",
        content: `Crie a análise baseada nestas notícias:\n${context.substring(0, 3000)}`
      }
    ],
    model,
    response_format: { type: "json_object" },
    temperature: 0.6
  });

  let rawContent = contentRes.choices[0]?.message?.content || "{}";
  rawContent = rawContent.replace(/```markdown|```html|```json|```/g, ""); 
  
  let result = JSON.parse(rawContent);

  console.log("🛡️ Etapa 2: Validando Qualidade Técnica...");
  if (!validatePost(result.content)) {
    throw new Error("O post não atingiu os critérios de qualidade técnica.");
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
