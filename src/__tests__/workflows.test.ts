import { describe, it, expect } from "vitest";
import { parse } from "yaml";
import fs from "fs";
import path from "path";

/**
 * Trava de sanidade dos workflows do GitHub Actions.
 *
 * Em 07/10/2026 um workflow foi empurrado com YAML inválido: o corpo de uma
 * issue, escrito como string multilinha, teve linhas fora da indentação do
 * bloco `run: |`, e uma linha iniciada por "**" (markdown) virou alias de YAML.
 *
 * O estrago foi silencioso e grave: o GitHub não consegue ler um workflow
 * inválido, então passou a tratá-lo como SEM GATILHOS. A geração diária não
 * rodaria nem no agendamento, e nada no repositório acusava o problema. Só
 * apareceu porque um disparo manual retornou 422.
 *
 * Estes testes vivem na suíte porque `npm test` já é gate dos três workflows e
 * roda também na máquina antes do push. Um YAML quebrado passa a barrar o
 * deploy em vez de depender de alguém lembrar de validar.
 */
const DIR = path.resolve(process.cwd(), ".github/workflows");
const arquivos = fs.readdirSync(DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

/** `on` é lido como booleano true pelo YAML 1.1; o parser aqui devolve a chave. */
function gatilhos(doc: Record<string, unknown>): Record<string, unknown> {
  const bruto = (doc["on"] ?? (doc as Record<string, unknown>)[String(true)]) as unknown;
  if (bruto && typeof bruto === "object") return bruto as Record<string, unknown>;
  // Forma de lista: `on: [push]`
  if (Array.isArray(bruto)) return Object.fromEntries((bruto as string[]).map((k) => [k, {}]));
  if (typeof bruto === "string") return { [bruto]: {} };
  return {};
}

describe("workflows do GitHub Actions", () => {
  it("existe pelo menos um workflow para validar", () => {
    expect(arquivos.length).toBeGreaterThan(0);
  });

  it.each(arquivos)("%s é YAML válido", (arquivo) => {
    const texto = fs.readFileSync(path.join(DIR, arquivo), "utf-8");
    // Falha aqui = o GitHub não conseguiria ler o arquivo e o trataria como
    // workflow sem gatilhos, deixando de executar sem avisar.
    expect(() => parse(texto)).not.toThrow();
  });

  it.each(arquivos)("%s declara nome, gatilhos e jobs", (arquivo) => {
    const doc = parse(fs.readFileSync(path.join(DIR, arquivo), "utf-8")) as Record<string, unknown>;
    expect(doc.name, "workflow sem 'name'").toBeTruthy();
    expect(Object.keys(gatilhos(doc)).length, "workflow sem gatilho em 'on'").toBeGreaterThan(0);
    expect(Object.keys((doc.jobs ?? {}) as object).length, "workflow sem 'jobs'").toBeGreaterThan(0);
  });

  it("a geração diária mantém agendamento E disparo manual", () => {
    const doc = parse(fs.readFileSync(path.join(DIR, "auto-blog.yml"), "utf-8")) as Record<string, unknown>;
    const g = gatilhos(doc);
    // schedule: sem ele o blog para de publicar.
    expect(Object.keys(g)).toContain("schedule");
    // workflow_dispatch: foi a ausência dele que denunciou o YAML quebrado, e é
    // como se dispara um post fora de hora ou se testa uma correção.
    expect(Object.keys(g)).toContain("workflow_dispatch");
  });

  it("todo job declara runs-on", () => {
    for (const arquivo of arquivos) {
      const doc = parse(fs.readFileSync(path.join(DIR, arquivo), "utf-8")) as Record<string, unknown>;
      for (const [nome, job] of Object.entries((doc.jobs ?? {}) as Record<string, any>)) {
        expect(job["runs-on"], `${arquivo}: job '${nome}' sem runs-on`).toBeTruthy();
      }
    }
  });
});
