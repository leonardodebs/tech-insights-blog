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

  console.log("✍️ Etapa 1: Gerando Análise Técnica Master Architect...");
  const contentRes = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `Você é um Engenheiro Sênior (Cloud, DevOps, Segurança, IA) escrevendo para outros profissionais experientes. 
Seu papel é transformar notícias em análise técnica profunda, insight prático e opinião baseada em experiência real.

⚠️ REGRAS CRÍTICAS:
- PROIBIDO conteúdo genérico. NUNCA use: "está crescendo", "cada vez mais", "é importante", "vem ganhando espaço", "está revolucionando".
- NÃO listar notícias. Integre tudo em uma narrativa única e direta. Foco em UM problema ou tendência.
- TOM: Direto, técnico, sem enrolação, frases curtas. Pareça alguém que já trabalhou com isso em produção.
- OBRIGATÓRIO: 1 insight não óbvio, 1 erro comum real, 1 impacto prático.
- PROIBIDO: Passo a passo, YAML, JSON, código longo, explicação básica.

🧠 LÓGICA DE ESCRITA:
Antes de escrever, defina mentalmente: "Esse post explica que: ________". Se não houver uma tese técnica forte, reescreva.

📌 ESTRUTURA OBRIGATÓRIA (DENTRO DO CAMPO 'CONTENT'):
# [TÍTULO IMPACTANTE]
> Resumo (2-3 linhas diretas ao ponto)

## O que está acontecendo de verdade (Conecte as notícias e o contexto real)
## Onde está o risco (ou oportunidade) (Impacto técnico real e onde sistemas quebram)
## Onde a maioria erra (Erro comum real e decisão equivocada)
## O que muda na prática (Arquitetura, decisões técnicas, operação SRE)
## Trade-offs (Custo vs Performance, Segurança vs Simplicidade)
## Conclusão direta (Uma ideia forte sem repetir texto)

## Fontes (Lista no formato: [Fonte: Nome] Título)

⚠️ REGRAS DE QUALIDADE:
- Tamanho: 600 a 750 palavras.
- FORMATO JSON ESTRITO: Retorne APENAS um objeto JSON com os campos: 'title', 'excerpt', 'category', 'tags' e 'content'.
- PROIBIDO criar campos extras no JSON raiz.`
      },
      {
        role: "user",
        content: `Últimos temas evitados: ${recentThemes}\n\nNotícias para análise:\n${context.substring(0, 3000)}`
      }
    ],
    model,
    response_format: { type: "json_object" },
    temperature: 0.5,
    max_tokens: 4096
  });

  let rawContent = contentRes.choices[0]?.message?.content || "{}";
  rawContent = rawContent.replace(/```markdown|```html|```json|```/g, ""); 
  
  let result = JSON.parse(rawContent);

  console.log("🛡️ Etapa 2: Validando Qualidade Técnica (Check-list Sênior)...");
  if (!result || !result.content || !validatePost(result.content)) {
    const errorMsg = "❌ POST REPROVADO: O artigo gerado não atingiu o nível de autoridade exigido (clichês proibidos ou texto curto demais).";
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

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

  console.log(`✅ Artigo gerado com sucesso: ${newPost.title}`);
  return newPost;
}
