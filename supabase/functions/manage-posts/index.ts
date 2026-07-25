/**
 * manage-posts — exclusão de post, restrita a administradores.
 *
 * Superfície mais sensível do sistema: recebe `postId` controlado pelo cliente.
 * Sem verificação de autorização, isso era IDOR com exclusão arbitrária de
 * conteúdo (achado 05.1). A guarda `requireAdmin` fecha essa brecha.
 */
import { handlePreflight, jsonResponse, requireAdmin, dispatchWorkflow } from "../_shared/guard.ts";

/**
 * IDs de post são gerados como `post-${Date.now()}`. Validar o formato no
 * servidor impede que valor arbitrário chegue ao workflow, que usa o input em
 * shell/jq — defesa contra injeção de argumento.
 */
const POST_ID_PATTERN = /^post-\d{10,20}$/;

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  // Autenticação + autorização antes de qualquer processamento.
  const guard = await requireAdmin(req);
  if ("error" in guard) return guard.error;

  let body: { action?: string; postId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Corpo da requisição inválido." }, 400);
  }

  const { action, postId } = body;

  if (action !== "delete") {
    return jsonResponse({ error: "Ação não suportada." }, 400);
  }

  if (typeof postId !== "string" || !POST_ID_PATTERN.test(postId)) {
    return jsonResponse({ error: "Identificador de post inválido." }, 400);
  }

  const result = await dispatchWorkflow("manage-posts.yml", { action, postId });
  if (!result.ok) {
    return jsonResponse({ error: result.detail }, result.status);
  }

  console.log(`Post ${postId} marcado para exclusão por ${guard.admin.email}.`);
  return jsonResponse({ success: true, message: "Exclusão solicitada." });
});
