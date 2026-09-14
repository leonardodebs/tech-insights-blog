/**
 * Camada de provedores de LLM para a geração dos posts.
 *
 * O motor rodava direto no Claude. Em 14/09/2026 o saldo da API acabou e a
 * publicação ficou parada por semanas, então a geração passou a usar provedores
 * de camada gratuita, com cadeia de fallback: tenta o Gemini e, se ele falhar
 * (erro, cota, resposta inválida), cai para o Groq.
 *
 * Um provedor sem chave configurada é PULADO, não quebra a cadeia. Isso permite
 * rodar só com o Gemini hoje e ganhar a reserva do Groq apenas adicionando
 * GROQ_API_KEY, sem tocar em código.
 *
 * O contrato é um só: recebe instrução de sistema, prompt e o schema esperado,
 * devolve o objeto do post já parseado. Toda a lógica de qualidade (validação,
 * rotação de categoria, procedência de URL) continua em automation.ts, agnóstica
 * de quem gerou o texto.
 */
import { GoogleGenAI } from "@google/genai";

export interface ResultadoPost {
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  content: string;
  linkedinCaption: string;
  linkedinHashtags: string[];
}

/**
 * Schema do post. É o mesmo contrato que antes vivia no `input_schema` da tool
 * do Claude, agora compartilhado entre os provedores: o Gemini recebe como
 * response_format nativo e o Groq recebe descrito no prompt.
 */
export function montarSchemaPost(categoria: string): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      title: { type: "string", description: "Título do post refletindo a tese central" },
      excerpt: { type: "string", description: "Resumo de 2-3 linhas com a tese explícita" },
      category: { type: "string", enum: [categoria] },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Lista de 3-5 tags técnicas",
      },
      content: {
        type: "string",
        description: "Conteúdo completo do post em markdown seguindo a estrutura obrigatória",
      },
      linkedinCaption: {
        type: "string",
        description:
          "Legenda para post no LinkedIn (perfil pessoal), baseada na mesma tese do artigo mas reescrita para o formato da rede: gancho forte nas 2 primeiras linhas (antes do 'ver mais'), parágrafos curtos com quebras de linha, SEM headers markdown, tom direto para profissionais de tecnologia. Termine com uma pergunta que convide comentário. NÃO inclua hashtags (vão em campo separado) nem o link do post (será adicionado automaticamente).",
      },
      linkedinHashtags: {
        type: "array",
        items: { type: "string" },
        description:
          '3 a 5 hashtags relevantes para o post no LinkedIn, sem o símbolo #, em CamelCase quando for mais de uma palavra (ex.: ["CloudComputing", "DevOps", "Kubernetes"]).',
      },
    },
    required: [
      "title",
      "excerpt",
      "category",
      "tags",
      "content",
      "linkedinCaption",
      "linkedinHashtags",
    ],
  };
}

/** Limpa a chave de aspas e espaços que costumam vir coladas ao copiar do painel. */
function lerChave(nome: string): string {
  return (process.env[nome] || "").trim().replace(/^["']|["']$/g, "");
}

/**
 * Extrai o objeto JSON de uma resposta de texto.
 *
 * O Gemini com response_format devolve JSON puro, mas o Groq às vezes embrulha
 * em cerca de markdown (```json ... ```) mesmo em modo JSON. Recortar do primeiro
 * `{` até o último `}` cobre os dois casos sem depender do provedor se comportar.
 */
export function extrairJson(texto: string): ResultadoPost {
  const limpo = texto.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (inicio === -1 || fim === -1 || fim <= inicio) {
    throw new Error("Resposta do modelo não contém um objeto JSON.");
  }
  return JSON.parse(limpo.slice(inicio, fim + 1)) as ResultadoPost;
}

interface ArgsGeracao {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
}

/**
 * Gemini. Usa a Interactions API com response_format nativo, então o modelo é
 * obrigado a devolver JSON no formato do schema.
 *
 * Modelo configurável por GEMINI_MODEL. O padrão é um Flash, que é o suficiente
 * para este volume (1 post por dia) e o que cabe na camada gratuita.
 */
async function gerarComGemini({ system, prompt, schema }: ArgsGeracao): Promise<ResultadoPost> {
  const apiKey = lerChave("GEMINI_API_KEY");
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
  const client = new GoogleGenAI({ apiKey });

  const interaction = await client.interactions.create({
    model,
    system_instruction: system,
    input: prompt,
    response_format: { type: "text", mime_type: "application/json", schema },
    // Posts reais têm 5-7 mil caracteres; margem folgada evita truncar o JSON
    // no meio do artigo, que foi o que já esvaziou o campo `content` no passado.
    generation_config: { max_output_tokens: 8192 },
  });

  const texto = interaction.output_text;
  if (!texto) throw new Error("Gemini devolveu resposta sem texto.");
  return extrairJson(texto);
}

/**
 * Provedor genérico compatível com a API da OpenAI (Groq e OpenRouter falam esse
 * mesmo dialeto, então uma função serve para os dois, mudando só a URL base).
 *
 * Diferente do Gemini, o modo JSON aqui não aceita um schema arbitrário: garante
 * JSON sintaticamente válido, mas não o formato. Por isso o schema vai descrito
 * na instrução de sistema. A validação em automation.ts continua sendo a rede de
 * segurança para o conteúdo.
 */
async function gerarComOpenAICompat(
  nome: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  headersExtra: Record<string, string>,
  { system, prompt, schema }: ArgsGeracao,
): Promise<ResultadoPost> {
  const systemComSchema =
    `${system}\n\n━━━ FORMATO DA RESPOSTA ━━━\n` +
    `Responda APENAS com um objeto JSON válido, sem texto antes ou depois e sem cercas de markdown, ` +
    `seguindo exatamente este schema:\n${JSON.stringify(schema, null, 2)}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...headersExtra,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemComSchema },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const detalhe = await res.text();
    throw new Error(`${nome} respondeu ${res.status}: ${detalhe.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  // O OpenRouter às vezes devolve 200 com erro no corpo (ex.: modelo sem cota).
  if (json.error?.message) throw new Error(`${nome}: ${json.error.message}`);

  const texto = json.choices?.[0]?.message?.content;
  if (!texto) throw new Error(`${nome} devolveu resposta sem conteúdo.`);
  return extrairJson(texto);
}

/**
 * Groq. Modelo configurável por GROQ_MODEL.
 *
 * O padrão é gpt-oss-120b, o maior modelo de texto do catálogo do Groq em
 * 14/09/2026. Boa parte do catálogo dele NÃO serve aqui (whisper é áudio,
 * prompt-guard é classificador de segurança, orpheus é voz), então trocar às
 * cegas não funciona: rode o workflow "Check LLM Providers", que lista os
 * modelos disponíveis na conta quando o configurado não existe.
 */
function gerarComGroq(args: ArgsGeracao): Promise<ResultadoPost> {
  return gerarComOpenAICompat(
    "Groq",
    "https://api.groq.com/openai/v1",
    lerChave("GROQ_API_KEY"),
    process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b",
    {},
    args,
  );
}

/**
 * OpenRouter. Agrega dezenas de modelos atrás de uma chave só, incluindo opções
 * gratuitas (identificadas pelo sufixo `:free`).
 *
 * O padrão é `openrouter/free`, o roteador de modelos gratuitos do próprio
 * OpenRouter: ele escolhe entre os gratuitos disponíveis no momento, então NÃO
 * quebra quando um modelo específico deixa de ser gratuito. Foi exatamente esse
 * o erro do primeiro diagnóstico (14/09/2026): o modelo fixo que estava aqui
 * passou a ser pago e a chamada virou 404.
 *
 * Para fixar um modelo específico (mais previsível em qualidade), defina a
 * variável OPENROUTER_MODEL. Veja os gratuitos com response_format em
 * https://openrouter.ai/models?q=free — mas lembre que ele pode sair da lista.
 *
 * Os headers HTTP-Referer e X-Title são opcionais e servem para identificar a
 * aplicação nos rankings do OpenRouter.
 */
function gerarComOpenRouter(args: ArgsGeracao): Promise<ResultadoPost> {
  return gerarComOpenAICompat(
    "OpenRouter",
    "https://openrouter.ai/api/v1",
    lerChave("OPENROUTER_API_KEY"),
    process.env.OPENROUTER_MODEL?.trim() || "openrouter/free",
    {
      "HTTP-Referer": "https://leonardodebs.github.io/tech-insights-blog/",
      "X-Title": "TechPulse AI",
    },
    args,
  );
}

/** Ordem da cadeia: o primeiro com chave configurada é o principal. */
const PROVEDORES = [
  { nome: "Gemini", chave: "GEMINI_API_KEY", gerar: gerarComGemini },
  { nome: "OpenRouter", chave: "OPENROUTER_API_KEY", gerar: gerarComOpenRouter },
  { nome: "Groq", chave: "GROQ_API_KEY", gerar: gerarComGroq },
] as const;

/** Nomes dos provedores que têm chave configurada no ambiente. */
export function provedoresDisponiveis(): string[] {
  return PROVEDORES.filter((p) => lerChave(p.chave)).map((p) => p.nome);
}

/**
 * Percorre a cadeia até um provedor devolver um post. Erro de um provedor não
 * interrompe: registra e passa para o próximo. Só lança se todos falharem, com
 * o motivo de cada um, para o log dizer o que houve sem exigir investigação.
 */
export async function gerarPost(args: ArgsGeracao): Promise<{ resultado: ResultadoPost; provedor: string }> {
  const disponiveis = PROVEDORES.filter((p) => lerChave(p.chave));

  if (disponiveis.length === 0) {
    throw new Error(
      "Nenhum provedor de IA configurado. Defina GEMINI_API_KEY (principal) ou GROQ_API_KEY (reserva).",
    );
  }

  const falhas: string[] = [];
  for (const p of disponiveis) {
    try {
      const resultado = await p.gerar(args);
      return { resultado, provedor: p.nome };
    } catch (err) {
      const motivo = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ ${p.nome} falhou: ${motivo}`);
      falhas.push(`${p.nome}: ${motivo}`);
    }
  }

  throw new Error(`Todos os provedores falharam. ${falhas.join(" | ")}`);
}
