/**
 * Diagnóstico da cadeia de provedores de IA.
 *
 * Faz uma chamada mínima em CADA provedor configurado e relata quem responde.
 * Serve para validar chave nova sem precisar gerar um post de verdade, que
 * publicaria conteúdo no blog só para testar credencial.
 *
 * Uso local:
 *   GEMINI_API_KEY=... OPENROUTER_API_KEY=... npx tsx scripts/check-llm-providers.ts
 *
 * No CI: workflow "Check LLM Providers" (manual, workflow_dispatch).
 *
 * Sai com código 1 se NENHUM provedor responder, para o workflow falhar de forma
 * visível. Um provedor quebrado no meio da cadeia não derruba o resultado, já que
 * o objetivo da cadeia é justamente sobreviver a isso.
 */
import { gerarPost, montarSchemaPost, provedoresDisponiveis } from "../src/services/llm";

// Prompt deliberadamente trivial: queremos gastar o mínimo de tokens possível,
// então pedimos o menor post válido em vez do artigo completo.
const SYSTEM = "Você é um gerador de teste. Responda no formato pedido, com textos curtos.";
const PROMPT =
  'Teste de conectividade. Devolva um objeto com title "teste", excerpt "teste", ' +
  'category "DevOps", tags ["teste"], content "teste", linkedinCaption "teste" e ' +
  'linkedinHashtags ["Teste"].';

async function main() {
  const disponiveis = provedoresDisponiveis();

  console.log("🔎 Diagnóstico da cadeia de provedores\n");
  console.log(`Provedores com chave configurada: ${disponiveis.join(" → ") || "(nenhum)"}\n`);

  if (disponiveis.length === 0) {
    console.error("❌ Nenhuma chave configurada (GEMINI_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY).");
    process.exit(1);
  }

  const resultados: Array<{ nome: string; ok: boolean; detalhe: string }> = [];

  // Testa um de cada vez. Como gerarPost percorre a cadeia inteira, isolamos
  // cada provedor limpando temporariamente as chaves dos outros — assim o
  // relatório diz exatamente quem respondeu e quem falhou.
  for (const alvo of disponiveis) {
    const todas = ["GEMINI_API_KEY", "OPENROUTER_API_KEY", "GROQ_API_KEY"];
    const mapaChave: Record<string, string> = {
      Gemini: "GEMINI_API_KEY",
      OpenRouter: "OPENROUTER_API_KEY",
      Groq: "GROQ_API_KEY",
    };
    const guardadas: Record<string, string | undefined> = {};
    for (const c of todas) {
      guardadas[c] = process.env[c];
      if (c !== mapaChave[alvo]) delete process.env[c];
    }

    const inicio = Date.now();
    try {
      const { resultado, provedor } = await gerarPost({
        system: SYSTEM,
        prompt: PROMPT,
        schema: montarSchemaPost("DevOps"),
      });
      const ms = Date.now() - inicio;
      const ok = typeof resultado?.title === "string";
      resultados.push({
        nome: provedor,
        ok,
        detalhe: ok ? `respondeu em ${ms}ms` : "resposta sem os campos esperados",
      });
    } catch (err) {
      const motivo = err instanceof Error ? err.message : String(err);
      resultados.push({ nome: alvo, ok: false, detalhe: motivo.slice(0, 200) });
    } finally {
      for (const c of todas) {
        if (guardadas[c] === undefined) delete process.env[c];
        else process.env[c] = guardadas[c];
      }
    }
  }

  console.log("Resultado por provedor:\n");
  for (const r of resultados) {
    console.log(`  ${r.ok ? "✅" : "❌"} ${r.nome.padEnd(12)} ${r.detalhe}`);
  }

  const vivos = resultados.filter((r) => r.ok).length;
  console.log(`\n${vivos} de ${resultados.length} provedores respondendo.`);

  if (vivos === 0) {
    console.error("\n❌ Nenhum provedor respondeu. A geração diária vai falhar.");
    process.exit(1);
  }
  if (vivos < resultados.length) {
    console.log("\n⚠️ Há provedor com problema, mas a cadeia sobrevive com os que responderam.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
