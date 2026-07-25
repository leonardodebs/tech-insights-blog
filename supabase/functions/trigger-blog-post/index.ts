/**
 * trigger-blog-post — dispara a geração manual de um post, restrita a admins.
 *
 * Abuso desta função tem custo financeiro direto: cada execução consome crédito
 * da API Anthropic e minutos de GitHub Actions. Sem autorização, qualquer
 * usuário registrado podia acioná-la em loop (achado 05.1 e seção 13).
 *
 * Além da guarda de admin, há um limite de taxa simples em memória para conter
 * disparos repetidos acidentais ou automatizados.
 */
import { handlePreflight, jsonResponse, requireAdmin, dispatchWorkflow } from "../_shared/guard.ts";

/**
 * Janela mínima entre disparos, por administrador.
 *
 * Limitação conhecida: o estado vive na memória da instância, então não é
 * compartilhado entre instâncias nem sobrevive a um cold start. Serve como
 * contenção de abuso trivial, não como controle rígido. Um limite durável
 * exigiria uma tabela no Postgres com a última execução por usuário.
 */
const MIN_INTERVAL_MS = 60_000;
const lastRun = new Map<string, number>();

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  const guard = await requireAdmin(req);
  if ("error" in guard) return guard.error;

  const now = Date.now();
  const previous = lastRun.get(guard.admin.id) ?? 0;
  const elapsed = now - previous;

  if (elapsed < MIN_INTERVAL_MS) {
    const waitSeconds = Math.ceil((MIN_INTERVAL_MS - elapsed) / 1000);
    return jsonResponse(
      { error: `Aguarde ${waitSeconds}s antes de disparar novamente.` },
      429,
    );
  }

  const result = await dispatchWorkflow("auto-blog.yml");
  if (!result.ok) {
    return jsonResponse({ error: result.detail }, result.status);
  }

  lastRun.set(guard.admin.id, now);
  console.log(`Geração de post disparada por ${guard.admin.email}.`);
  return jsonResponse({ success: true, message: "Workflow iniciado." });
});
