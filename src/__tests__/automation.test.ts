import { describe, it, expect } from "vitest";
import { validatePost, mapCategory, findEmDashFields } from "../services/automation";

describe("validatePost", () => {
  const validContent = `## O que está acontecendo
O AWS lançou uma nova feature de cloud computing com suporte a Kubernetes e Docker.
Isso tem impacto direto em como os times de DevOps configuram seus clusters.

## Insights e Riscos
- Redução de latência em 40% para workloads containerizados
- Trade-off: custo maior para instâncias spot com preempção frequente
- Security: nova surface de ataque via IMDS v2 não habilitado por padrão
- Observability: métricas de auto-scaling exigem novos dashboards de custo
- Kubernetes: o controller precisa de RBAC adicional para gerenciar as novas primitivas de rede,
  o que implica revisão de service accounts em clusters multi-tenant já em produção.

## O que muda na prática
**Arquiteto:** revisar blueprints de multi-region com as novas primitivas.
**DevOps/MLOps:** atualizar pipelines de CI/CD para aproveitar o novo auto-scaling.
A superfície de exposição cresce proporcionalmente ao número de contas gerenciadas,
exigindo que o time de Segurança revise as políticas de acesso antes de habilitar
o recurso em produção. Equipes que não fizerem essa revisão correm risco de manter
permissões herdadas de perfis antigos que nunca foram revogados corretamente
ao longo dos últimos ciclos de rotação programada de acesso.

## Conclusão direta
A mudança representa um ponto de inflexão para equipes que operam na AWS em escala.
Sua empresa já tem uma política de identity federation para workloads em múltiplas contas?

## Fontes
[Fonte: AWS Blog] AWS lança suporte nativo a Kubernetes multi-cluster`;

  it("aprova conteúdo técnico válido", () => {
    expect(validatePost(validContent)).toBe(true);
  });

  it("rejeita conteúdo undefined", () => {
    expect(validatePost(undefined)).toBe(false);
  });

  it("rejeita conteúdo vazio", () => {
    expect(validatePost("")).toBe(false);
  });

  it("rejeita conteúdo com termo proibido 'está crescendo'", () => {
    const bad = validContent.replace("Redução de latência", "A adoção está crescendo");
    expect(validatePost(bad)).toBe(false);
  });

  it("rejeita conteúdo com termo proibido 'revolucionário'", () => {
    const bad = validContent.replace("ponto de inflexão", "avanço revolucionário");
    expect(validatePost(bad)).toBe(false);
  });

  it("rejeita conteúdo sem pergunta na conclusão", () => {
    const noCTA = validContent.replace(
      "Sua empresa já tem uma política de identity federation para workloads em múltiplas contas?",
      "Empresas devem se adaptar rapidamente."
    );
    expect(validatePost(noCTA)).toBe(false);
  });

  it("rejeita conteúdo sem termos técnicos", () => {
    const noTech = validContent
      .replace(/aws|cloud|linux|security|devops|kubernetes|docker|ia|ai|observability/gi, "sistema");
    expect(validatePost(noTech)).toBe(false);
  });

  it("rejeita conteúdo muito curto (< 1500 chars)", () => {
    expect(validatePost("## Conclusão direta\nAI cloud? Sim.")).toBe(false);
  });
});

describe("mapCategory", () => {
  it("retorna categorias válidas sem alteração", () => {
    expect(mapCategory("Cloud")).toBe("Cloud");
    expect(mapCategory("Observability")).toBe("Observability");
    expect(mapCategory("AI")).toBe("AI");
    expect(mapCategory("Security")).toBe("Security");
    expect(mapCategory("DevOps")).toBe("DevOps");
    expect(mapCategory("Startups")).toBe("Startups");
    expect(mapCategory("Open Source")).toBe("Open Source");
  });

  it("mapeia variantes de Segurança", () => {
    expect(mapCategory("Segurança")).toBe("Security");
    expect(mapCategory("Cybersecurity")).toBe("Security");
    expect(mapCategory("cyber")).toBe("Security");
  });

  it("mapeia variantes de IA", () => {
    expect(mapCategory("Inteligência Artificial")).toBe("AI");
    expect(mapCategory("ia")).toBe("AI");
  });

  it("mapeia variantes de Cloud", () => {
    expect(mapCategory("Nuvem")).toBe("Cloud");
    expect(mapCategory("computação em nuvem")).toBe("Cloud");
  });

  it("mapeia variantes de DevOps", () => {
    expect(mapCategory("devops")).toBe("DevOps");
    expect(mapCategory("MLOps")).toBe("DevOps");
  });

  it("mapeia variantes de Startups", () => {
    expect(mapCategory("Negócios")).toBe("Startups");
    expect(mapCategory("startups tech")).toBe("Startups");
  });

  it("usa Cloud como fallback para categoria desconhecida", () => {
    expect(mapCategory("Quantum")).toBe("Cloud");
    expect(mapCategory("")).toBe("Cloud");
  });
});

describe("findEmDashFields", () => {
  it("não acusa nada quando não há travessão em nenhum campo", () => {
    expect(findEmDashFields({
      title: "Título sem travessão",
      excerpt: "Resumo, sem travessão.",
      content: "Conteúdo normal.",
      linkedinCaption: "Legenda normal."
    })).toEqual([]);
  });

  it("identifica cada campo que contém travessão", () => {
    expect(findEmDashFields({
      title: "Título — com travessão",
      excerpt: "Resumo normal.",
      content: "Conteúdo — também com travessão.",
      linkedinCaption: "Legenda normal."
    })).toEqual(["title", "content"]);
  });

  it("retorna vazio para result nulo ou undefined", () => {
    expect(findEmDashFields(null)).toEqual([]);
    expect(findEmDashFields(undefined)).toEqual([]);
  });
});
