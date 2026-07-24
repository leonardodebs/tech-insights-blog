/**
 * O campo `content` gerado pela IA começa com o título (# ...) e o resumo
 * (> ...), que também existem nos campos `title` e `excerpt` do post e são
 * exibidos separadamente na página. Renderizar o content cru duplicava o
 * título na tela e mostrava o resumo com o ">" literal.
 *
 * Esta função remove o título e o bloco de resumo do INÍCIO do content,
 * deixando o corpo a partir da primeira seção (## ...). Usada tanto no app
 * React (runtime) quanto no script de SSG (build), para as duas rotas de
 * renderização ficarem consistentes.
 */
export function stripLeadingTitleAndSummary(content: string): string {
  if (!content) return "";

  const lines = content.split("\n");
  let i = 0;

  // Pula linhas em branco iniciais
  while (i < lines.length && lines[i].trim() === "") i++;

  // Remove o primeiro heading de nível 1 (# título), se houver
  if (i < lines.length && /^#\s+/.test(lines[i].trim())) {
    i++;
    while (i < lines.length && lines[i].trim() === "") i++;
  }

  // Remove um bloco de blockquote inicial (> resumo), incluindo múltiplas linhas
  if (i < lines.length && lines[i].trim().startsWith(">")) {
    while (i < lines.length && lines[i].trim().startsWith(">")) i++;
    while (i < lines.length && lines[i].trim() === "") i++;
  }

  return lines.slice(i).join("\n").trim();
}
