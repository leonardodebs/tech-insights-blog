import { GoogleGenAI } from "@google/genai";
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

function validatePost(content: string | undefined): boolean {
  if (!content) return false;
  const lower = content.toLowerCase();
  const techTerms = ["aws", "cloud", "linux", "security", "devops", "kubernetes", "docker", "ia", "ai", "observability"];
  const forbiddenTerms = ["está crescendo", "cada vez mais", "é importante", "vem ganhando espaço", "está revolucionando", "revolucionário", "inovadora", "escalável", "preciso", "líder de mercado"];

  const hasTechTerm = techTerms.some(term => lower.includes(term));
  const hasForbiddenTerm = forbiddenTerms.some(term => lower.includes(term));
  const hasMinLength = content.length >= 3000; // Mínimo de 600+ palavras

  return hasTechTerm && !hasForbiddenTerm && hasMinLength;
}

export async function runAutomation(targetCategory?: string | null) {
  console.log("🚀 Iniciando Motor Master Architect V5.2 (Produção)...");

  const apiKey = (process.env.GEMINI_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey) throw new Error("Chave GEMINI_API_KEY não configurada.");

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-2.5-flash";

  let existingPosts: Post[] = [];
  if (fs.existsSync(POSTS_PATH)) {
    existingPosts = JSON.parse(fs.readFileSync(POSTS_PATH, "utf-8") || "[]");
  }

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

  const maxAttempts = 3;
  let lastResult = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`✍️ Tentativa ${attempt}/${maxAttempts}: Gerando Análise Técnica Master Architect...`);

    const contentRes = await ai.models.generateContent({
      model,
      contents: `Crie a análise técnica baseada nestas notícias:\n${context.substring(0, 3000)}`,
      config: {
        systemInstruction: `Você é um Engenheiro Sênior (Cloud, DevOps, Segurança, IA) escrevendo para outros profissionais experientes. 
Seu papel é transformar notícias em análise técnica profunda, insight prático e opinião baseada em experiência real.

⚠️ REGRAS CRÍTICAS (A NÃO OBSERVÂNCIA RESULTARÁ EM REJEIÇÃO):
- PROIBIDO conteúdo genérico. NUNCA use: "está crescendo", "cada vez mais", "é importante", "vem ganhando espaço", "está revolucionando", "revolucionário", "inovador", "escalável", "preciso", "líder de mercado".
- MÍNIMO de 650 palavras. Seja denso e detalhista.
- NÃO listar notícias. Integre tudo em uma narrativa técnica direta.
- FOCO: Explique o "Como" e os "Trade-offs" de arquitetura.

- CATEGORIA OBRIGATÓRIA: Escolha EXCLUSIVAMENTE uma das seguintes categorias para o campo 'category': [Cloud, Linux, AI, Security, DevOps, Startups]. É PROIBIDO criar categorias novas ou mistas.

📌 ESTRUTURA OBRIGATÓRIA (DENTRO DO CAMPO 'CONTENT'):
# [TÍTULO IMPACTANTE]
> Resumo (2-3 linhas diretas)

## O que está acontecendo de verdade
## Onde está o risco (ou oportunidade)
## Onde a maioria erra
## O que muda na prática
## Trade-offs
## Conclusão direta
## Fontes (Lista no formato: [Fonte: Nome] Título)

⚠️ FORMATO JSON EXCLUSIVO: Retorne APENAS um objeto JSON com os campos: 'title', 'excerpt', 'category', 'tags' e 'content'.`,
        responseMimeType: "application/json",
        temperature: 0.5
      }
    });

    let rawContent = contentRes.text || "{}";
    rawContent = rawContent.replace(/```markdown|```html|```json|```/g, "");

    const result = JSON.parse(rawContent);

    console.log(`🛡️ Validando Qualidade da Tentativa ${attempt}...`);
    if (result && result.content && validatePost(result.content)) {
      lastResult = result;
      break; // Sucesso!
    } else {
      console.warn(`⚠️ Tentativa ${attempt} reprovada. O artigo era muito curto ou continha clichês.`);
      if (attempt === maxAttempts) {
        const errorMsg = "❌ MOTOR EXAUSTO: A IA falhou em gerar um post de elite após 3 tentativas.";
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
    }
  }

  const result = lastResult!;
  
  // Limpeza e Normalização de Categoria (Garante que o post apareça no menu)
  const validCategories = ["Cloud", "Linux", "AI", "Security", "DevOps", "Startups"];
  let finalCategory = result.category || "Cloud";
  
  // Se a IA inventar nomes em PT ou errados, mapeamos para os oficiais
  if (!validCategories.includes(finalCategory)) {
    const lowerCat = finalCategory.toLowerCase();
    if (lowerCat.includes("segur") || lowerCat.includes("cyber") || lowerCat.includes("security")) finalCategory = "Security";
    else if (lowerCat.includes("inteligenc") || lowerCat.includes("ai") || lowerCat.includes("ia")) finalCategory = "AI";
    else if (lowerCat.includes("nuve") || lowerCat.includes("cloud")) finalCategory = "Cloud";
    else if (lowerCat.includes("start") || lowerCat.includes("negoci")) finalCategory = "Startups";
    else if (lowerCat.includes("dev") || lowerCat.includes("ops")) finalCategory = "DevOps";
    else if (lowerCat.includes("lin") || lowerCat.includes("bash")) finalCategory = "Linux";
    else finalCategory = "Cloud"; // Fallback final
  }

  const newPost: Post = {
    id: `post-${Date.now()}`,
    title: result.title,
    date: new Date().toISOString(),
    excerpt: result.excerpt,
    content: result.content,
    tags: result.tags || [],
    category: finalCategory
  };

  existingPosts.unshift(newPost);
  fs.writeFileSync(POSTS_PATH, JSON.stringify(existingPosts, null, 2));

  console.log(`✅ Artigo gerado com sucesso: ${newPost.title}`);
  return newPost;
}
