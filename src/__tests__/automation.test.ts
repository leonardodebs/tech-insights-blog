import { describe, it, expect } from "vitest";
import { validatePost, validatePostDetailed, mapCategory, findEmDashFields, stripEmDash, pickTargetCategory, extractSourceUrls } from "../services/automation";

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
[Fonte: AWS Blog] [AWS lança suporte nativo a Kubernetes multi-cluster](https://aws.amazon.com/blogs/aws/exemplo)`;

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

  it("rejeita fonte sem link markdown real", () => {
    const noLink = validContent.replace(
      "[Fonte: AWS Blog] [AWS lança suporte nativo a Kubernetes multi-cluster](https://aws.amazon.com/blogs/aws/exemplo)",
      "[Fonte: AWS Blog] AWS lança suporte nativo a Kubernetes multi-cluster"
    );
    expect(validatePost(noLink)).toBe(false);
  });

  it("rejeita quando há múltiplas fontes e apenas uma tem link", () => {
    const mixed = validContent.replace(
      "## Fontes\n[Fonte: AWS Blog] [AWS lança suporte nativo a Kubernetes multi-cluster](https://aws.amazon.com/blogs/aws/exemplo)",
      "## Fontes\n[Fonte: AWS Blog] [AWS lança suporte nativo a Kubernetes multi-cluster](https://aws.amazon.com/blogs/aws/exemplo)\n[Fonte: InfoQ] Artigo sem link nenhum"
    );
    expect(validatePost(mixed)).toBe(false);
  });

  it("aprova quando a fonte tem link markdown real", () => {
    expect(validatePost(validContent)).toBe(true);
  });

  it("rejeita conteúdo sem seção Fontes", () => {
    const noSources = validContent.replace(
      /## Fontes\n\[Fonte: AWS Blog\].*$/,
      ""
    );
    expect(validatePost(noSources)).toBe(false);
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

describe("procedência das URLs de fonte", () => {
  // Caso real de 07/08/2026: o modelo publicou como fonte uma URL do padrão
  // antigo do blog do Rust, reconstruída de memória. Dava 404, e a validação
  // aprovava porque só checava o formato do link markdown.
  const URL_REAL = "https://blog.rust-lang.org/2026/07/13/crates-io-development-update/";
  const URL_INVENTADA = "https://blog.rust-lang.org/inside-rust/2024/07/09/crates-io-development-update.html";

  const comFonte = (url: string) => `## Insights e Riscos
Análise técnica sobre kubernetes, cloud e supply chain com profundidade suficiente
para passar o mínimo de caracteres exigido pela validação do post gerado.
${"Detalhe técnico relevante sobre auditoria de dependências e infraestrutura. ".repeat(20)}

## Conclusão direta
Síntese do trade-off analisado no artigo de hoje.
Sua equipe audita o conteúdo real das dependências antes do deploy?

## Fontes
[Fonte: Rust Blog] [crates.io: development update](${url})`;

  it("aprova URL que veio do contexto", () => {
    expect(validatePost(comFonte(URL_REAL), [URL_REAL])).toBe(true);
  });

  it("REPROVA URL que não estava no contexto (inventada)", () => {
    expect(validatePost(comFonte(URL_INVENTADA), [URL_REAL])).toBe(false);
  });

  it("explica no motivo qual URL foi inventada", () => {
    const r = validatePostDetailed(comFonte(URL_INVENTADA), [URL_REAL]);
    expect(r.reasons.join(" ")).toContain(URL_INVENTADA);
  });

  it("ignora diferenças de barra final, www e query na comparação", () => {
    const semBarra = "https://blog.rust-lang.org/2026/07/13/crates-io-development-update";
    expect(validatePost(comFonte(semBarra), [URL_REAL])).toBe(true);
    expect(validatePost(comFonte(URL_REAL + "?utm_source=rss"), [URL_REAL])).toBe(true);
  });

  it("sem allowedUrls, mantém o comportamento anterior (não reprova)", () => {
    expect(validatePost(comFonte(URL_INVENTADA))).toBe(true);
  });

  it("extractSourceUrls pega só as URLs da seção Fontes", () => {
    expect(extractSourceUrls(comFonte(URL_REAL))).toEqual([URL_REAL]);
  });
});

describe("pickTargetCategory", () => {
  // Helper: monta posts falsos só com a categoria, do mais recente para o mais antigo.
  const mk = (cats: string[]) => cats.map((category, i) => ({
    id: `p${i}`, title: "", excerpt: "", content: "", date: "", category, tags: [],
  })) as any[];

  it("nunca repete a categoria do post mais recente", () => {
    const posts = mk(["DevOps", "Cloud", "AI", "Security", "Startups"]);
    for (let i = 0; i < 50; i++) {
      expect(pickTargetCategory(posts)).not.toBe("DevOps");
    }
  });

  it("nunca repete nenhuma das 2 categorias mais recentes (quebra sequências)", () => {
    // Cenário real do bug: dois DevOps seguidos não podem gerar um terceiro.
    const posts = mk(["DevOps", "DevOps", "Cloud", "AI", "Security", "Startups", "Observability"]);
    for (let i = 0; i < 50; i++) {
      expect(pickTargetCategory(posts)).not.toBe("DevOps");
    }
  });

  it("prefere a categoria menos usada entre as candidatas", () => {
    // Open Source é a mais rara; as 2 recentes (DevOps, Cloud) estão bloqueadas.
    const posts = mk([
      "DevOps", "Cloud", "AI", "AI", "Security", "Security",
      "Startups", "Startups", "Observability", "Observability", "AI",
    ]);
    expect(pickTargetCategory(posts)).toBe("Open Source");
  });

  it("não quebra quando há menos de 2 posts", () => {
    expect(() => pickTargetCategory(mk(["DevOps"]))).not.toThrow();
    expect(() => pickTargetCategory(mk([]))).not.toThrow();
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

describe("stripEmDash", () => {
  it("substitui ' — ' no meio de frase por vírgula", () => {
    expect(stripEmDash("A latência caiu — em produção — pela metade."))
      .toBe("A latência caiu, em produção, pela metade.");
  });

  it("substitui travessão colado entre palavras por vírgula com espaço", () => {
    expect(stripEmDash("custo—benefício")).toBe("custo, benefício");
  });

  it("remove travessão no início de linha (fala/lista)", () => {
    expect(stripEmDash("— Primeiro ponto\n— Segundo ponto"))
      .toBe("Primeiro ponto\nSegundo ponto");
  });

  it("trata o travessão médio (en dash) também", () => {
    expect(stripEmDash("Arquiteto – DevOps – MLOps")).toBe("Arquiteto, DevOps, MLOps");
  });

  it("não deixa vírgula solta antes de pontuação final", () => {
    // "palavra —." não deve virar "palavra ,."
    expect(stripEmDash("Isso resolve o problema —.")).toBe("Isso resolve o problema.");
  });

  it("não gera vírgulas duplicadas", () => {
    expect(stripEmDash("a — , b")).not.toContain(", ,");
  });

  it("o resultado nunca contém travessão", () => {
    const entrada = "Título — com — vários—travessões – de – tipos.";
    expect(stripEmDash(entrada)).not.toMatch(/[—–]/);
  });

  it("preserva texto que já está sem travessão", () => {
    const limpo = "Texto normal, com vírgulas e pontos. Nada a mudar.";
    expect(stripEmDash(limpo)).toBe(limpo);
  });
});
