/**
 * Guarda de segurança compartilhada pelas Edge Functions.
 *
 * Corrige o achado crítico 05.1 da auditoria: as funções validavam apenas que
 * o JWT era válido (autenticação) e tratavam qualquer usuário autenticado como
 * administrador (ausência de autorização). Com o cadastro público habilitado no
 * projeto, qualquer pessoa podia se registrar e operar o painel.
 *
 * Princípio aplicado: FAIL CLOSED. Se a allowlist não estiver configurada e o
 * usuário não tiver o papel de admin, o acesso é NEGADO. Uma configuração
 * ausente nunca deve resultar em acesso liberado.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Origem única autorizada a chamar estas funções pelo navegador. */
const ALLOWED_ORIGIN = "https://leonardodebs.github.io";

export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Resposta ao preflight CORS. Retorna null se não for um preflight. */
export function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

export interface AuthorizedAdmin {
  id: string;
  email: string;
}

/**
 * Verifica o JWT e confirma que o usuário é administrador.
 *
 * Dois critérios aceitos, em ordem de robustez:
 *  1. `app_metadata.role === "admin"` — app_metadata não pode ser alterado pelo
 *     próprio usuário, apenas pela service_role. É o critério preferido.
 *  2. e-mail presente na allowlist da variável ADMIN_EMAILS (separada por vírgula).
 *
 * Retorna o admin autorizado, ou uma Response de erro pronta para devolver.
 */
export async function requireAdmin(
  req: Request,
): Promise<{ admin: AuthorizedAdmin } | { error: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: jsonResponse({ error: "Não autorizado." }, 401) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("SUPABASE_URL ou SUPABASE_ANON_KEY ausentes no ambiente.");
    return { error: jsonResponse({ error: "Erro de configuração do servidor." }, 500) };
  }

  // Cliente com o JWT do chamador: getUser() valida a assinatura no servidor.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { error: jsonResponse({ error: "Não autorizado." }, 401) };
  }

  const user = data.user;
  const email = (user.email ?? "").toLowerCase();

  // Critério 1: papel em app_metadata (não manipulável pelo usuário)
  const role = (user.app_metadata as Record<string, unknown> | null)?.role;
  const hasAdminRole = role === "admin";

  // Critério 2: allowlist explícita por e-mail
  const allowlist = (Deno.env.get("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const inAllowlist = email.length > 0 && allowlist.includes(email);

  if (!hasAdminRole && !inAllowlist) {
    // Log para auditoria; resposta ao cliente permanece genérica.
    console.warn(`Acesso negado para usuário ${user.id} (${email || "sem e-mail"}).`);
    return { error: jsonResponse({ error: "Acesso negado." }, 403) };
  }

  return { admin: { id: user.id, email } };
}

/**
 * Dispara um workflow do GitHub via workflow_dispatch.
 * O PAT nunca sai do ambiente da função.
 */
export async function dispatchWorkflow(
  workflowFile: string,
  inputs: Record<string, string> = {},
): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
  // O secret configurado no projeto chama-se GITHUB_PAT. O fallback para
  // GITHUB_TOKEN existe para não quebrar caso o secret seja renomeado.
  const token = Deno.env.get("GITHUB_PAT") ?? Deno.env.get("GITHUB_TOKEN");
  const repo = Deno.env.get("GITHUB_REPO") ?? "leonardodebs/tech-insights-blog";
  const ref = Deno.env.get("GITHUB_REF") ?? "main";

  if (!token) {
    console.error("GITHUB_PAT (ou GITHUB_TOKEN) ausente no ambiente da função.");
    return { ok: false, status: 500, detail: "Erro de configuração do servidor." };
  }

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "techpulse-edge-function",
      },
      body: JSON.stringify(Object.keys(inputs).length ? { ref, inputs } : { ref }),
    },
  );

  // workflow_dispatch bem-sucedido responde 204 sem corpo.
  if (res.status === 204) return { ok: true };

  const detail = await res.text();
  console.error(`GitHub dispatch falhou (${res.status}): ${detail}`);
  return { ok: false, status: 502, detail: "Falha ao acionar o workflow." };
}
