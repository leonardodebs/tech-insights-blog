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

// Feeds organizados por categoria para garantir cobertura balanceada.
//
// Auditoria de 07/08/2026: vários feeds estavam mortos ou congelados, e isso era
// a causa REAL dos posts repetidos. Em DevOps, 2 dos 3 feeds eram inúteis
// (devops.com dava 403, infoq/devops parado há 4 anos), sobrando só o
// kubernetes.io: com uma única fonte viva, a automação repetiu "Gateway API
// v1.6" por 4 dias. Observability tinha 2 de 4 mortos (grafana 404, devops 403).
//
// Removidos: devops.com (403), grafana.com/blog/rss.xml (404, virou index.xml),
// cloud.google.com/blog/rss.xml (XML inválido), infoq/devops (parado 1554d),
// opensource.com (parado 1158d), venturebeat/ai (parado 80d).
// Todos os substitutos abaixo foram testados: HTTP 200 e publicação recente.
// Mínimo de 4 fontes por categoria, para nunca depender de uma só.
const FEEDS_BY_CATEGORY: Record<Category, string[]> = {
  Cloud: [
    "https://aws.amazon.com/blogs/aws/feed/",
    "https://azure.microsoft.com/en-us/blog/feed/",
    "https://cloudblog.withgoogle.com/rss/",
    "https://aws.amazon.com/blogs/architecture/feed/",
    "https://www.infoq.com/feed/cloud-computing/",
  ],
  AI: [
    "https://openai.com/news/rss.xml",
    "https://huggingface.co/blog/feed.xml",
    "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
    "https://simonwillison.net/atom/everything/",
    "https://arstechnica.com/information-technology/feed/",
  ],
  Security: [
    "https://www.bleepingcomputer.com/feed/",
    "https://www.darkreading.com/rss.xml",
    "https://krebsonsecurity.com/feed/",
    "https://openssf.org/feed/",
  ],
  DevOps: [
    "https://kubernetes.io/feed.xml",
    "https://www.docker.com/blog/feed/",
    "https://about.gitlab.com/atom.xml",
    "https://www.hashicorp.com/blog/feed.xml",
    "https://blog.cloudflare.com/rss/",
  ],
  Observability: [
    "https://grafana.com/blog/index.xml",
    "https://opentelemetry.io/blog/index.xml",
    "https://www.cncf.io/blog/feed/",
    "https://prometheus.io/blog/feed.xml",
  ],
  Startups: [
    "https://techcrunch.com/category/startups/feed/",
    "https://www.wired.com/category/business/feed/",
    "https://tecnoblog.net/feed/",
    "https://netflixtechblog.com/feed",
  ],
  "Open Source": [
    "https://github.blog/feed/",
    "https://lwn.net/headlines/rss",
    "https://blog.rust-lang.org/feed.xml",
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

/**
 * Remove travessão de um texto substituindo pela pontuação adequada ao contexto.
 * O Claude Haiku reincide no travessão em certos temas mesmo com a instrução
 * explícita de não usar. Em vez de rejeitar o post inteiro (o que já travou uma
 * geração diária), corrigimos automaticamente antes de validar — o resultado
 * respeita a regra de estilo e o conteúdo não se perde.
 *
 * Trata também travessões "grudados" sem espaço (a—b) e o travessão médio (–).
 */
export function stripEmDash(text: string): string {
  return text
    // 1) travessão no início de linha (fala/lista) → remove. Vem antes das
    //    outras regras para não ter a quebra de linha consumida por elas.
    //    [ \t]* (não \s) para não atravessar o \n.
    .replace(/^[ \t]*[—–][ \t]*/gm, "")
    // 2) " — " no meio de frase → vírgula (aposto/inciso). Só espaço horizontal,
    //    para nunca colar duas linhas em uma.
    .replace(/[ \t]+[—–][ \t]+/g, ", ")
    // 3) travessão colado entre palavras (sem espaço) → vírgula com espaço
    .replace(/(\p{L})[—–](\p{L})/gu, "$1, $2")
    // 4) qualquer travessão remanescente (ex.: antes de pontuação) → vírgula
    .replace(/[—–]/g, ",")
    // 5) higiene: vírgula duplicada, espaço antes de vírgula, vírgula antes de
    //    pontuação final.
    .replace(/,[ \t]*,/g, ",")
    .replace(/[ \t]+,/g, ",")
    .replace(/,([ \t]*[.!?])/g, "$1");
}

/** Aplica stripEmDash a todos os campos de texto do resultado, retornando cópia limpa. */
function sanitizeEmDash(result: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...result };
  for (const field of EM_DASH_FIELDS) {
    if (typeof cleaned[field] === "string") {
      cleaned[field] = stripEmDash(cleaned[field] as string);
    }
  }
  return cleaned;
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

// Retorna a categoria menos representada nos últimos N posts, mas nunca uma das
// categorias dos 2 posts mais recentes.
//
// Só balancear pela contagem produzia SEQUÊNCIAS: uma categoria em déficit (ex.:
// DevOps zerado) era escolhida vários dias seguidos até empatar, gerando 4 posts
// do mesmo tema em fila. Excluir as 2 últimas categorias quebra a sequência sem
// abrir mão do balanceamento de longo prazo.
export function pickTargetCategory(posts: Post[], windowSize = 21): Category {
  const recent = posts.slice(0, windowSize);
  const counts: Record<string, number> = {};
  for (const cat of ALL_CATEGORIES) counts[cat] = 0;
  for (const p of recent) {
    if (counts[p.category] !== undefined) counts[p.category]++;
  }

  // Categorias dos 2 posts mais recentes ficam de fora dos candidatos.
  const blocked = new Set(posts.slice(0, 2).map((p) => p.category));
  let candidates = ALL_CATEGORIES.filter((c) => !blocked.has(c));
  if (candidates.length === 0) candidates = [...ALL_CATEGORIES];

  // Entre os candidatos, menor contagem primeiro; empate resolvido no aleatório.
  const sorted = candidates.sort((a, b) => {
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

  // Deduplication: últimos 10 posts, com as tags para o modelo enxergar o
  // produto/tecnologia central (não só o título) e evitar repetir o assunto.
  const recentPostsSummary = existingPosts.slice(0, 10).map(p =>
    `- "${p.title}" [${p.category}] — temas: ${(p.tags || []).slice(0, 4).join(", ")}`
  ).join("\n");

  // Busca notícias: prioriza feeds da categoria alvo + feeds gerais
  const categoryFeeds = FEEDS_BY_CATEGORY[forcedCategory] || [];
  const allFeedsToFetch = [...categoryFeeds, ...GENERAL_FEEDS];
  const newsItems: string[] = [];

  // Feeds que falham são registrados no log em vez de ignorados em silêncio.
  // O `catch` vazio anterior foi o que permitiu feeds apodrecerem por anos sem
  // ninguém notar (devops.com com 403, infoq parado há 4 anos), degradando a
  // variedade de temas até a automação repetir o mesmo assunto.
  const deadFeeds: string[] = [];

  for (const url of allFeedsToFetch) {
    try {
      const feed = await parser.parseURL(url);
      feed.items.slice(0, 4).forEach(item => {
        const link = item.link || "";
        newsItems.push(`- [Fonte: ${feed.title}] ${item.title}: ${item.contentSnippet || ""} (URL: ${link})`);
      });
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      deadFeeds.push(`${url} (${motivo})`);
    }
  }

  if (deadFeeds.length > 0) {
    console.warn(`⚠️ ${deadFeeds.length} feed(s) falharam:`);
    deadFeeds.forEach((f) => console.warn(`   - ${f}`));
  }

  // Alerta alto quando sobram poucas fontes vivas na categoria: é o sinal de que
  // a variedade de temas vai cair e os posts começam a repetir assunto.
  const liveCategoryFeeds = categoryFeeds.length -
    deadFeeds.filter((f) => categoryFeeds.some((c) => f.startsWith(c))).length;
  if (liveCategoryFeeds < 2) {
    console.warn(
      `🚨 Apenas ${liveCategoryFeeds} feed(s) vivo(s) em ${forcedCategory}. ` +
      `Risco alto de repetir tema: revise FEEDS_BY_CATEGORY.`,
    );
  }

  // Garante que notícias dos feeds da categoria aparecem no contexto. Embaralha
  // as da categoria também: sem isso, a matéria dominante de um feed (ex.: um
  // release em alta no Kubernetes) ficava sempre no topo e era escolhida todo
  // dia, gerando posts repetidos. Embaralhar dá variedade dia a dia.
  const categoryNews = newsItems
    .slice(0, categoryFeeds.length * 4)
    .sort(() => Math.random() - 0.5);
  const generalNews = newsItems.slice(categoryFeeds.length * 4);
  const shuffledGeneral = generalNews.sort(() => Math.random() - 0.5).slice(0, 4);
  const context = [...categoryNews, ...shuffledGeneral].slice(0, 12).join("\n");

  const deduplicationHint = recentPostsSummary
    ? `\n\n⚠️ POSTS RECENTES — NÃO escreva sobre o mesmo produto, release, ferramenta ou tecnologia central destes. Escolha um assunto claramente diferente:\n${recentPostsSummary}\n\nSe as notícias abaixo forem dominadas por um assunto já coberto acima (ex.: o mesmo release ou produto), IGNORE essas notícias e escolha outra menos óbvia do contexto. Repetir o produto/release central de um post recente é reprovação automática.\n`
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

    // Corrige o travessão automaticamente em vez de reprovar o post por causa
    // dele. O modelo reincide no travessão em certos temas mesmo instruído a não
    // usar; rejeitar por isso já travou uma geração diária inteira. A regra de
    // estilo continua garantida — o travessão some do resultado final.
    if (findEmDashFields(result).length > 0) {
      console.log(`✂️ Travessão detectado, sanitizando automaticamente...`);
      result = sanitizeEmDash(result);
    }

    console.log(`🛡️ Validando Qualidade da Tentativa ${attempt}...`);
    const validation = validatePostDetailed(result?.content);
    const reasons = [...validation.reasons];

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
