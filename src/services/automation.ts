import Anthropic from "@anthropic-ai/sdk";
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

const ALL_CATEGORIES = ["Cloud", "Observability", "AI", "Security", "DevOps", "Startups", "Open Source"] as const;
type Category = typeof ALL_CATEGORIES[number];

// Feeds organizados por categoria para garantir cobertura balanceada
const FEEDS_BY_CATEGORY: Record<Category, string[]> = {
  Cloud: [
    "https://aws.amazon.com/blogs/aws/feed/",
    "https://azure.microsoft.com/en-us/blog/feed/",
    "https://cloud.google.com/blog/rss.xml",
    "https://www.infoq.com/feed/cloud-computing/",
  ],
  AI: [
    "https://openai.com/news/rss.xml",
    "https://venturebeat.com/category/ai/feed/",
    "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
    "https://arstechnica.com/information-technology/feed/",
  ],
  Security: [
    "https://www.bleepingcomputer.com/feed/",
    "https://www.darkreading.com/rss.xml",
    "https://krebsonsecurity.com/feed/",
  ],
  DevOps: [
    "https://kubernetes.io/feed.xml",
    "https://devops.com/feed/",
    "https://www.infoq.com/feed/devops/",
  ],
  Observability: [
    "https://grafana.com/blog/rss.xml",
    "https://opentelemetry.io/blog/index.xml",
    "https://www.cncf.io/blog/feed/",
    "https://devops.com/feed/",
  ],
  Startups: [
    "https://techcrunch.com/category/startups/feed/",
    "https://www.wired.com/category/business/feed/",
    "https://tecnoblog.net/feed/",
  ],
  "Open Source": [
    "https://github.blog/feed/",
    "https://opensource.com/feed",
    "https://www.linux.com/feed/",
    "https://www.cncf.io/blog/feed/",
  ],
};

// Feeds gerais usados como complemento
const GENERAL_FEEDS = [
  "https://arstechnica.com/information-technology/feed/",
  "https://www.wired.com/category/business/feed/",
  "https://techcrunch.com/category/startups/feed/",
];

const TECH_TERMS = ["aws", "cloud", "security", "devops", "kubernetes", "docker", "ai", "observability", "open source", "startup", "grafana", "telemetry", "github", "api", "infra"];

// Jargão de marketing banido. Casado com fronteira de palavra (via \p{L}) para
// não derrubar o post por substring — ex.: "impreciso" não deve casar "preciso".
const FORBIDDEN_TERMS = [
  "está crescendo", "cada vez mais", "é importante", "vem ganhando espaço",
  "está revolucionando", "revolucionário", "inovadora", "líder de mercado",
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsTerm(text: string, term: string): boolean {
  return new RegExp(`(^|[^\\p{L}])${escapeRegex(term)}([^\\p{L}]|$)`, "iu").test(text);
}

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
}

/** Valida o post e explica cada reprovação, para realimentar o modelo no retry. */
export function validatePostDetailed(content: string | undefined): ValidationResult {
  const reasons: string[] = [];
  if (!content) return { ok: false, reasons: ["Conteúdo vazio."] };

  const lower = content.toLowerCase();

  if (!TECH_TERMS.some(term => lower.includes(term))) {
    reasons.push("Falta terminologia técnica reconhecível (ex.: cloud, kubernetes, API, observability).");
  }

  const hits = FORBIDDEN_TERMS.filter(term => containsTerm(content, term));
  if (hits.length > 0) {
    reasons.push(`Contém jargão de marketing proibido: ${hits.map(h => `"${h}"`).join(", ")}. Reescreva sem essas expressões.`);
  }

  if (content.length < 1500) {
    reasons.push(`Texto curto demais (${content.length} caracteres). Mínimo de 1500.`);
  }

  // Aceita "## Conclusão direta", "## Conclusão Direta", "## Conclusao", etc.
  const conclusionMatch = content.match(/##\s*Conclus[ãa]o[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (!conclusionMatch) {
    reasons.push('Falta a seção "## Conclusão direta".');
  } else if (!conclusionMatch[1].includes("?")) {
    reasons.push('A "## Conclusão direta" precisa terminar com uma pergunta provocativa (com "?").');
  }

  // Aceita "## Fontes" — cada linha deve ser um link markdown real, não só texto solto
  const sourcesMatch = content.match(/##\s*Fontes[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (!sourcesMatch) {
    reasons.push('Falta a seção "## Fontes".');
  } else {
    const sourceLines = sourcesMatch[1].split("\n").map(l => l.trim()).filter(Boolean);
    const unlinkedLines = sourceLines.filter(l => !/\]\(https?:\/\/[^\s)]+\)/.test(l));
    if (sourceLines.length > 0 && unlinkedLines.length > 0) {
      reasons.push(`As fontes precisam ser links markdown reais no formato [Fonte: Nome] [Título](URL), usando a URL fornecida no contexto. Linhas sem link: ${unlinkedLines.length}.`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}

export function validatePost(content: string | undefined): boolean {
  return validatePostDetailed(content).ok;
}

const EM_DASH_FIELDS = ["title", "excerpt", "content", "linkedinCaption"] as const;

/** Travessão é banido em todos os campos de texto voltados ao leitor (regra de estilo). */
export function findEmDashFields(result: Record<string, unknown> | null | undefined): string[] {
  if (!result) return [];
  return EM_DASH_FIELDS.filter(field => {
    const value = result[field];
    return typeof value === "string" && value.includes("—");
  });
}

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function mapCategory(raw: string): Category {
  if ((ALL_CATEGORIES as readonly string[]).includes(raw)) return raw as Category;

  const lower = stripAccents(raw.toLowerCase());
  if (lower.includes("segur") || lower.includes("cyber") || lower.includes("security")) return "Security";
  if (lower.includes("inteligenc") || lower.includes("ai") || lower.includes("ia")) return "AI";
  if (lower.includes("nuve") || lower.includes("cloud")) return "Cloud";
  if (lower.includes("start") || lower.includes("negoci")) return "Startups";
  if (lower.includes("dev") || lower.includes("ops")) return "DevOps";
  if (lower.includes("observ") || lower.includes("monitor") || lower.includes("telemetr") || lower.includes("tracing") || lower.includes("metrics")) return "Observability";
  if (lower.includes("open source") || lower.includes("opensource") || lower.includes("open-source") || lower.includes("foss") || lower.includes("github") || lower.includes("licen")) return "Open Source";
  return "Cloud";
}

// Retorna a categoria menos representada nos últimos N posts
function pickTargetCategory(posts: Post[], windowSize = 21): Category {
  const recent = posts.slice(0, windowSize);
  const counts: Record<string, number> = {};
  for (const cat of ALL_CATEGORIES) counts[cat] = 0;
  for (const p of recent) {
    if (counts[p.category] !== undefined) counts[p.category]++;
  }
  // Ordena por menor contagem, desempata aleatoriamente
  const sorted = [...ALL_CATEGORIES].sort((a, b) => {
    const diff = counts[a] - counts[b];
    return diff !== 0 ? diff : Math.random() - 0.5;
  });
  return sorted[0];
}

function isOverloadedError(err: any): boolean {
  const msg = err?.message || err?.toString() || "";
  const status = err?.status;
  return (
    status === 529 ||
    msg.includes("529") ||
    msg.includes("overloaded") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("overloaded_error")
  );
}

function buildSystemInstruction(targetCategory: Category): string {
  return `Você é um Engenheiro Sênior (Cloud, DevOps, Segurança, IA) escrevendo para outros profissionais experientes.

━━━ CATEGORIA OBRIGATÓRIA ━━━
⚠️ O post de hoje DEVE ser da categoria: **${targetCategory}**
Escreva a análise técnica com foco nessa categoria. Adapte o ângulo das notícias para esse tema.

━━━ ETAPA 1 — TRIAGEM (execute antes de escrever qualquer palavra) ━━━
1. Leia todas as notícias fornecidas.
2. Identifique UM tema central dentro de **${targetCategory}** que conecta as notícias mais relevantes.
3. Descarte notícias que não contribuam para esse tema.
4. Se necessário, use apenas 1 notícia — o que importa é a profundidade técnica.

━━━ ETAPA 2 — GERAÇÃO ━━━
Escreva o post com base APENAS nas notícias selecionadas.

⚠️ REGRAS CRÍTICAS (descumprimento = rejeição automática):
- PROIBIDO: "está crescendo", "cada vez mais", "é importante", "vem ganhando espaço", "está revolucionando", "revolucionário", "inovadora", "líder de mercado"
- PROIBIDO usar travessão (—) em QUALQUER campo (title, excerpt, content, linkedinCaption). Use vírgula, ponto ou reescreva a frase.
- MÍNIMO de 1500 caracteres
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
(1 parágrafo de síntese + 1 pergunta provocativa para o leitor)

## Fontes
(formato OBRIGATÓRIO: link markdown real — [Fonte: Nome] [Título](URL). Use exatamente a URL fornecida entre "(URL: ...)" de cada notícia no contexto, copiada sem alterar. NUNCA invente ou deixe uma fonte sem link. Liste apenas as fontes efetivamente usadas no texto)`;
}

export async function runAutomation(targetCategory?: string | null) {
  console.log("🚀 Iniciando Motor Master Architect V7.0 (Claude API + Rotação de Categorias)...");

  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey) throw new Error("Chave ANTHROPIC_API_KEY não configurada.");

  const client = new Anthropic({ apiKey });
  const MODEL = "claude-haiku-4-5";

  let existingPosts: Post[] = [];
  if (fs.existsSync(POSTS_PATH)) {
    existingPosts = JSON.parse(fs.readFileSync(POSTS_PATH, "utf-8") || "[]");
  }

  // Escolhe a categoria menos usada nos últimos 21 posts (3 ciclos de 7)
  const forcedCategory: Category = targetCategory
    ? mapCategory(targetCategory)
    : pickTargetCategory(existingPosts);

  console.log(`🎯 Categoria alvo: ${forcedCategory}`);

  // Deduplication: últimos 10 posts
  const recentPostsSummary = existingPosts.slice(0, 10).map(p =>
    `- "${p.title}" [${p.category}]`
  ).join("\n");

  // Busca notícias: prioriza feeds da categoria alvo + feeds gerais
  const categoryFeeds = FEEDS_BY_CATEGORY[forcedCategory] || [];
  const allFeedsToFetch = [...categoryFeeds, ...GENERAL_FEEDS];
  const newsItems: string[] = [];

  for (const url of allFeedsToFetch) {
    try {
      const feed = await parser.parseURL(url);
      feed.items.slice(0, 4).forEach(item => {
        const link = item.link || "";
        newsItems.push(`- [Fonte: ${feed.title}] ${item.title}: ${item.contentSnippet || ""} (URL: ${link})`);
      });
    } catch (e) { /* skip */ }
  }

  // Garante que notícias dos feeds da categoria aparecem no contexto
  const categoryNews = newsItems.slice(0, categoryFeeds.length * 4);
  const generalNews = newsItems.slice(categoryFeeds.length * 4);
  const shuffledGeneral = generalNews.sort(() => Math.random() - 0.5).slice(0, 4);
  const context = [...categoryNews, ...shuffledGeneral].slice(0, 12).join("\n");

  const deduplicationHint = recentPostsSummary
    ? `\n\n⚠️ POSTS RECENTES (EVITE REPETIR TESE OU ÂNGULO):\n${recentPostsSummary}\n`
    : "";

  // Limite maior que antes (era 4000) para acomodar as URLs de cada notícia
  // sem cortar o contexto no meio de um item.
  const prompt = `Crie a análise técnica sobre **${forcedCategory}** baseada nestas notícias:\n${context.substring(0, 5500)}${deduplicationHint}`;

  const maxAttempts = 5;
  let lastResult = null;
  let lastRejection: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`✍️ Tentativa ${attempt}/${maxAttempts} [${MODEL}]: Gerando post de ${forcedCategory}...`);

    // Realimenta o motivo da reprovação anterior para o modelo corrigir
    const retryFeedback = lastRejection.length > 0
      ? `\n\n⛔ A TENTATIVA ANTERIOR FOI REPROVADA PELOS SEGUINTES MOTIVOS — CORRIJA TODOS:\n${lastRejection.map(r => `- ${r}`).join("\n")}`
      : "";

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: MODEL,
        // O campo `content` sozinho costuma ter ~1500-2000 tokens (posts reais
        // têm 5-7 mil caracteres). 2048 no total era curto e truncava o JSON
        // da tool no meio do artigo em temas mais densos (ex.: Security),
        // fazendo `content` chegar vazio. 8192 dá margem confortável.
        max_tokens: 8192,
        system: buildSystemInstruction(forcedCategory),
        tools: [{
          name: "publish_post",
          description: "Publica o post técnico gerado com todos os campos obrigatórios.",
          input_schema: {
            type: "object" as const,
            properties: {
              title:    { type: "string", description: "Título do post refletindo a tese central" },
              excerpt:  { type: "string", description: "Resumo de 2-3 linhas com a tese explícita" },
              category: { type: "string", enum: [forcedCategory] },
              tags:     { type: "array", items: { type: "string" }, description: "Lista de 3-5 tags técnicas" },
              content:  { type: "string", description: "Conteúdo completo do post em markdown seguindo a estrutura obrigatória" },
              linkedinCaption: {
                type: "string",
                description: "Legenda para post no LinkedIn (perfil pessoal), baseada na mesma tese do artigo mas reescrita para o formato da rede: gancho forte nas 2 primeiras linhas (antes do 'ver mais'), parágrafos curtos com quebras de linha, SEM headers markdown, tom direto para profissionais de tecnologia. Termine com uma pergunta que convide comentário. NÃO inclua hashtags (vão em campo separado) nem o link do post (será adicionado automaticamente)."
              },
              linkedinHashtags: {
                type: "array",
                items: { type: "string" },
                description: "3 a 5 hashtags relevantes para o post no LinkedIn, sem o símbolo #, em CamelCase quando for mais de uma palavra (ex.: [\"CloudComputing\", \"DevOps\", \"Kubernetes\"])."
              }
            },
            required: ["title", "excerpt", "category", "tags", "content", "linkedinCaption", "linkedinHashtags"]
          }
        }],
        tool_choice: { type: "tool", name: "publish_post" },
        messages: [{ role: "user", content: prompt + retryFeedback }]
      });
    } catch (apiError: any) {
      const errorIsOverloaded = isOverloadedError(apiError);
      console.warn(`⚠️ Erro na API do Claude (tentativa ${attempt}):`, apiError.message || apiError);

      if (attempt === maxAttempts) {
        throw new Error("❌ MOTOR EXAUSTO: Falha na API do Claude após todas as tentativas.");
      }

      const baseDelay = errorIsOverloaded ? 30000 : 5000;
      const delay = baseDelay * attempt;
      console.log(`⏳ Aguardando ${delay / 1000}s antes da próxima tentativa...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }

    if (response.stop_reason === "max_tokens") {
      console.warn(`⚠️ Tentativa ${attempt}: resposta truncada por max_tokens — o JSON da tool pode ter ficado incompleto.`);
    }

    // Extrai resultado do tool use — JSON sempre válido
    const toolBlock = response.content.find(block => block.type === "tool_use");
    let result: any = null;
    if (toolBlock?.type === "tool_use") {
      result = toolBlock.input;
    } else {
      console.warn(`⚠️ Resposta sem tool_use na tentativa ${attempt}. Continuando...`);
      if (attempt === maxAttempts) {
        throw new Error("❌ MOTOR EXAUSTO: A IA falhou em usar a tool após todas as tentativas.");
      }
      continue;
    }

    console.log(`🛡️ Validando Qualidade da Tentativa ${attempt}...`);
    const validation = validatePostDetailed(result?.content);
    const emDashFields = findEmDashFields(result);
    const reasons = [...validation.reasons];
    if (emDashFields.length > 0) {
      reasons.push(`Contém travessão (—) proibido nos campos: ${emDashFields.join(", ")}. Reescreva essas frases sem travessão (use vírgula, ponto ou reformule).`);
    }

    if (reasons.length === 0) {
      lastResult = result;
      break;
    } else {
      lastRejection = reasons;
      console.warn(`⚠️ Tentativa ${attempt} reprovada:`);
      reasons.forEach(r => console.warn(`   - ${r}`));
      if (attempt === maxAttempts) {
        throw new Error("❌ MOTOR EXAUSTO: A IA falhou em gerar um post de elite após todas as tentativas.");
      }
    }
  }

  const result = lastResult!;

  const newPost: Post = {
    id: `post-${Date.now()}`,
    title: result.title,
    date: new Date().toISOString(),
    excerpt: result.excerpt,
    content: result.content,
    tags: result.tags || [],
    category: forcedCategory,
    linkedinCaption: result.linkedinCaption,
    linkedinHashtags: result.linkedinHashtags || []
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

  console.log(`✅ Artigo gerado com sucesso: [${newPost.category}] ${newPost.title}`);
  return newPost;
}
