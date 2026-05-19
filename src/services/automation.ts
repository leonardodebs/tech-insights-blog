import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
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

export function validatePost(content: string | undefined): boolean {
  if (!content) return false;
  const lower = content.toLowerCase();
  const techTerms = ["aws", "cloud", "linux", "security", "devops", "kubernetes", "docker", "ia", "ai", "observability"];
  const forbiddenTerms = ["está crescendo", "cada vez mais", "é importante", "vem ganhando espaço", "está revolucionando", "revolucionário", "inovadora", "escalável", "preciso", "líder de mercado"];

  const conclusionMatch = content.match(/## Conclusão direta([\s\S]*?)(## |$)/);
  const hasCTA = conclusionMatch ? conclusionMatch[1].includes("?") : false;

  const hasTechTerm = techTerms.some(term => lower.includes(term));
  const hasForbiddenTerm = forbiddenTerms.some(term => lower.includes(term));
  const hasMinLength = content.length >= 1500;

  return hasTechTerm && !hasForbiddenTerm && hasMinLength && hasCTA;
}

export function mapCategory(raw: string): string {
  const validCategories = ["Cloud", "Linux", "AI", "Security", "DevOps", "Startups"];
  if (validCategories.includes(raw)) return raw;

  const lower = raw.toLowerCase();
  if (lower.includes("segur") || lower.includes("cyber") || lower.includes("security")) return "Security";
  if (lower.includes("inteligenc") || lower.includes("ai") || lower.includes("ia")) return "AI";
  if (lower.includes("nuve") || lower.includes("cloud")) return "Cloud";
  if (lower.includes("start") || lower.includes("negoci")) return "Startups";
  if (lower.includes("dev") || lower.includes("ops")) return "DevOps";
  if (lower.includes("lin") || lower.includes("bash")) return "Linux";
  return "Cloud";
}

function is503Error(err: any): boolean {
  const msg = err?.message || err?.toString() || "";
  return msg.includes('"code":503') || msg.includes("503") || msg.includes("UNAVAILABLE");
}

const SYSTEM_INSTRUCTION = `Você é um Engenheiro Sênior (Cloud, DevOps, Segurança, IA) escrevendo para outros profissionais experientes.

━━━ ETAPA 1 — TRIAGEM (execute antes de escrever qualquer palavra) ━━━
1. Leia todas as notícias fornecidas.
2. Identifique UM tema central que conecta a maioria delas. Defina internamente: "Tese: ___"
3. Descarte qualquer notícia que não contribua diretamente para essa tese — mesmo que seja tecnicamente interessante.
4. Se restarem menos de 2 notícias relevantes, escolha o tema da notícia mais forte e descarte todas as outras.

━━━ ETAPA 2 — GERAÇÃO ━━━
Escreva o post com base APENAS nas notícias que passaram na triagem.

⚠️ REGRAS CRÍTICAS (descumprimento = rejeição automática):
- PROIBIDO: "está crescendo", "cada vez mais", "é importante", "vem ganhando espaço", "está revolucionando", "revolucionário", "inovador", "escalável", "líder de mercado"
- MÍNIMO de 400 palavras
- NÃO liste notícias — integre em narrativa técnica com tese clara
- FOCO: explique o "Como" e os "Trade-offs" reais de arquitetura
- O título deve refletir a tese, não o tema genérico

━━━ ESTRUTURA OBRIGATÓRIA (dentro do campo 'content') ━━━
# [TÍTULO QUE REFLETE A TESE]
> Resumo (2-3 linhas com a tese central explícita)

## O que está acontecendo
(contexto direto, sem floreios)

## Insights e Riscos
(bullet points com impacto concreto e trade-offs reais)

## O que muda na prática
(segmentado por perfil conforme relevância: Engenheiro de Segurança, Arquiteto, DevOps/MLOps)

## Conclusão direta
(1 parágrafo de síntese + 1 pergunta provocativa para o leitor, ex: "Sua empresa já tem uma política de identidade para agentes não-humanos?" ou "Como você está planejando a agilidade criptográfica para 2029?")

## Fontes
(formato: [Fonte: Nome] Título — apenas as fontes efetivamente usadas no texto)

━━━ CATEGORIA ━━━
Escolha EXCLUSIVAMENTE uma: Cloud | Linux | AI | Security | DevOps | Startups

━━━ SAÍDA ━━━
Retorne APENAS JSON com os campos: title, excerpt, category, tags, content`;

export async function runAutomation(targetCategory?: string | null) {
  console.log("🚀 Iniciando Motor Master Architect V5.2 (Produção)...");

  const apiKey = (process.env.GEMINI_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey) throw new Error("Chave GEMINI_API_KEY não configurada.");

  const ai = new GoogleGenAI({ apiKey });

  // Primary model with fallback for high-demand 503 errors
  const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

  let existingPosts: Post[] = [];
  if (fs.existsSync(POSTS_PATH)) {
    existingPosts = JSON.parse(fs.readFileSync(POSTS_PATH, "utf-8") || "[]");
  }

  // Deduplication: collect titles and tags from last 7 posts
  const recentPostsSummary = existingPosts.slice(0, 7).map(p =>
    `- "${p.title}" [${p.category}] tags: ${p.tags.join(", ")}`
  ).join("\n");

  const newsItems: string[] = [];
  for (const url of FEEDS) {
    try {
      const feed = await parser.parseURL(url);
      feed.items.slice(0, 5).forEach(item => {
        newsItems.push(`- [Fonte: ${feed.title}] ${item.title}: ${item.contentSnippet || ""}`);
      });
    } catch (e) { /* skip */ }
  }

  const context = newsItems.sort(() => Math.random() - 0.5).slice(0, 8).join("\n");

  const deduplicationHint = recentPostsSummary
    ? `\n\n⚠️ TÓPICOS RECENTES JÁ PUBLICADOS (EVITE REPETIR TESE OU ÂNGULO SIMILAR):\n${recentPostsSummary}\n`
    : "";

  const prompt = `Crie a análise técnica baseada nestas notícias:\n${context.substring(0, 3000)}${deduplicationHint}`;

  const maxAttempts = 5;
  let lastResult = null;
  let currentModelIndex = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const model = MODELS[currentModelIndex];
    console.log(`✍️ Tentativa ${attempt}/${maxAttempts} [${model}]: Gerando Análise Técnica Master Architect...`);

    let contentRes;
    try {
      contentRes = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          thinkingConfig: {
            thinkingBudget: 2500
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 0.5
        }
      });
    } catch (apiError: any) {
      const errorIs503 = is503Error(apiError);
      console.warn(`⚠️ Erro na API do Gemini (tentativa ${attempt}):`, apiError.message || apiError);

      if (attempt === maxAttempts) {
        throw new Error("❌ MOTOR EXAUSTO: Falha na API do Gemini após todas as tentativas.");
      }

      // On 503, switch to fallback model after 2 consecutive failures
      if (errorIs503 && attempt >= 2 && currentModelIndex < MODELS.length - 1) {
        currentModelIndex++;
        console.log(`🔄 Alternando para modelo fallback: ${MODELS[currentModelIndex]}`);
      }

      // Exponential backoff: 30s base for 503 (overload), 5s base for other errors
      const baseDelay = errorIs503 ? 30000 : 5000;
      const delay = baseDelay * attempt;
      console.log(`⏳ Aguardando ${delay / 1000}s antes da próxima tentativa...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }

    let rawContent = contentRes.text || "{}";
    rawContent = rawContent.replace(/```markdown|```html|```json|```/g, "");

    let result: any = null;
    try {
      result = JSON.parse(rawContent);
    } catch (e) {
      console.warn(`⚠️ Erro ao fazer parse do JSON na tentativa ${attempt}. Continuando...`);
      if (attempt === maxAttempts) {
        throw new Error("❌ MOTOR EXAUSTO: A IA falhou em gerar JSON válido após todas as tentativas.");
      }
      continue;
    }

    console.log(`🛡️ Validando Qualidade da Tentativa ${attempt}...`);
    if (result && result.content && validatePost(result.content)) {
      lastResult = result;
      break;
    } else {
      console.warn(`⚠️ Tentativa ${attempt} reprovada. O artigo falhou na validação de qualidade.`);
      if (attempt === maxAttempts) {
        throw new Error("❌ MOTOR EXAUSTO: A IA falhou em gerar um post de elite após todas as tentativas.");
      }
    }
  }

  const result = lastResult!;
  const finalCategory = mapCategory(result.category || "Cloud");

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

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from("posts").upsert({
      id: newPost.id,
      title: newPost.title,
      date: newPost.date,
      excerpt: newPost.excerpt,
      content: newPost.content,
      tags: newPost.tags,
      category: newPost.category,
    }, { onConflict: "id" });
    if (error) {
      console.warn(`⚠️ Post salvo em posts.json mas falhou no Supabase: ${error.message}`);
    } else {
      console.log(`☁️ Post sincronizado com Supabase.`);
    }
  } else {
    console.warn("⚠️ VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos — post salvo apenas em posts.json.");
  }

  console.log(`✅ Artigo gerado com sucesso: ${newPost.title}`);
  return newPost;
}
