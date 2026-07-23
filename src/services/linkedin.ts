/**
 * Publica um post no LinkedIn (perfil pessoal) via LinkedIn Posts API.
 * Chamado por scripts/post-to-linkedin.ts logo após um novo post do blog ser gerado.
 *
 * Formato escolhido: link em texto plano dentro de `commentary` — o LinkedIn
 * gera o preview do link automaticamente (mesmo comportamento de colar um
 * link na caixa de post pela UI). Isso evita precisar subir uma imagem de
 * thumbnail via LinkedIn Images API só para anexar um post do tipo "article".
 */
import { Post } from "../types";

// Formato YYYYMM exigido pela API. Atualizar periodicamente — ver
// https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
const LINKEDIN_API_VERSION = "202607";
const BASE_URL = "https://leonardodebs.github.io/tech-insights-blog";

// Limite defensivo — a API rejeita commentary excessivamente longo
// (FIELD_LENGTH_TOO_LONG). Não há um número exato documentado publicamente,
// então truncamos com margem de segurança em vez de arriscar a chamada falhar.
const MAX_COMMENTARY_LENGTH = 2900;

// O campo `commentary` usa o "little text format" do LinkedIn, onde estes
// caracteres são reservados para sintaxe de menção/hashtag/template
// (ex.: @[Nome](urn), {hashtag|#|tag}). Qualquer ocorrência literal desses
// caracteres no texto livre PRECISA ser escapada com \, senão o parser do
// LinkedIn quebra no meio da string e trunca silenciosamente o resto do post
// (foi exatamente o bug: um parêntese literal na legenda cortou tudo depois,
// incluindo hashtags e link). Ver:
// https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format
const LITTLE_FORMAT_RESERVED = /[\\|{}@[\]()<>#*_~]/g;

function escapeLittleText(text: string): string {
  return text.replace(LITTLE_FORMAT_RESERVED, "\\$&");
}

export interface LinkedInPostResult {
  postUrn: string;
}

function isTransientError(status: number): boolean {
  return status === 429 || status >= 500;
}

export function buildCommentary(post: Post): string {
  const rawCaption = post.linkedinCaption?.trim();
  if (!rawCaption) {
    throw new Error("Post não tem linkedinCaption — nada para publicar no LinkedIn.");
  }

  // Escapa a legenda (texto livre, pode conter parênteses/colchetes/etc).
  // As hashtags são construídas por nós no formato "#Palavra" simples, que já
  // é sintaxe válida de HashtagElement — não devem ser escapadas.
  const caption = escapeLittleText(rawCaption);

  const hashtags = (post.linkedinHashtags || [])
    .slice(0, 5)
    .map(tag => `#${tag.replace(/^#/, "").replace(/\s+/g, "")}`)
    .join(" ");

  const postUrl = `${BASE_URL}/posts/${post.id}/`;
  const cta = `Artigo completo com os detalhes técnicos:\n${postUrl}`;

  let commentary = [caption, hashtags, cta].filter(Boolean).join("\n\n");

  if (commentary.length > MAX_COMMENTARY_LENGTH) {
    const overflow = commentary.length - MAX_COMMENTARY_LENGTH;
    let truncatedCaption = caption.slice(0, Math.max(0, caption.length - overflow - 1));
    // Evita deixar uma barra de escape solta no ponto de corte
    truncatedCaption = truncatedCaption.replace(/\\+$/, "") + "…";
    commentary = [truncatedCaption, hashtags, cta].filter(Boolean).join("\n\n");
  }

  return commentary;
}

export async function postToLinkedIn(post: Post): Promise<LinkedInPostResult> {
  const accessToken = (process.env.LINKEDIN_ACCESS_TOKEN || "").trim();
  const personUrn = (process.env.LINKEDIN_PERSON_URN || "").trim();

  if (!accessToken) throw new Error("LINKEDIN_ACCESS_TOKEN não configurado.");
  if (!personUrn) throw new Error("LINKEDIN_PERSON_URN não configurado.");

  const commentary = buildCommentary(post);

  const body = {
    author: personUrn,
    commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const maxAttempts = 3;
  let lastError: Error = new Error("Falha desconhecida ao publicar no LinkedIn.");

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "Linkedin-Version": LINKEDIN_API_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 201) {
      const postUrn = res.headers.get("x-restli-id") || "";
      return { postUrn };
    }

    const errorText = await res.text();
    lastError = new Error(`LinkedIn API respondeu ${res.status}: ${errorText}`);

    if (!isTransientError(res.status) || attempt === maxAttempts) {
      throw lastError;
    }

    const delay = 5000 * attempt;
    console.log(`⏳ Erro transitório (${res.status}) na tentativa ${attempt}, aguardando ${delay / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  throw lastError;
}
