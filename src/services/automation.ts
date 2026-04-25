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

  const conclusionMatch = content.match(/## Conclusão direta([\s\S]*?)(## |$)/);
  const hasCTA = conclusionMatch ? conclusionMatch[1].includes("?") : false;

  const hasTechTerm = techTerms.some(term => lower.includes(term));
  const hasForbiddenTerm = forbiddenTerms.some(term => lower.includes(term));
  const hasMinLength = content.length >= 1500; // Mínimo de ~350-400 palavras (mais direto)

  return hasTechTerm && !hasForbiddenTerm && hasMinLength && hasCTA;
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

  const context = newsItems.sort(() => Math.random() - 0.5).slice(0, 8).join("\n");

  const maxAttempts = 3;
  let lastResult = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`✍️ Tentativa ${attempt}/${maxAttempts}: Gerando Análise Técnica Master Architect...`);

    let contentRes;
    try {
      contentRes = await ai.models.generateContent({
        model,
        contents: `Crie a análise técnica baseada nestas notícias:\n${context.substring(0, 3000)}`,
        config: {
          thinkingConfig: {
            thinkingBudget: 8000
          },
          systemInstruction: `Você é um Engenheiro Sênior (Cloud, DevOps, Segurança, IA) escrevendo para outros profissionais experientes.

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
Retorne APENAS JSON com os campos: title, excerpt, category, tags, content`,
          responseMimeType: "application/json",
          temperature: 0.5
        }
      });
    } catch (apiError: any) {
      console.warn(`⚠️ Erro na API do Gemini (tentativa ${attempt}):`, apiError.message || apiError);
      if (attempt === maxAttempts) {
        throw new Error("❌ MOTOR EXAUSTO: Falha na API do Gemini após 3 tentativas.");
      }
      await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
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
        throw new Error("❌ MOTOR EXAUSTO: A IA falhou em gerar JSON válido após 3 tentativas.");
      }
      continue;
    }

    console.log(`🛡️ Validando Qualidade da Tentativa ${attempt}...`);
    if (result && result.content && validatePost(result.content)) {
      lastResult = result;
      break; // Sucesso!
    } else {
      console.warn(`⚠️ Tentativa ${attempt} reprovada. O artigo falhou na validação de qualidade.`);
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
