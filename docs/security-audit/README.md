# Auditoria de segurança

Relatório: [`relatorio-auditoria-seguranca.pdf`](relatorio-auditoria-seguranca.pdf) (13 páginas, A4).

## Como regerar

O ambiente é isolado num venv local, que não é versionado.

```bash
python -m venv docs/security-audit/.venv
docs/security-audit/.venv/Scripts/python.exe -m pip install reportlab matplotlib
docs/security-audit/.venv/Scripts/python.exe docs/security-audit/gerar_relatorio.py
```

Em Linux ou macOS, troque `Scripts` por `bin`.

## Organização

Os dados estão separados da diagramação de propósito: para uma nova rodada de
auditoria basta atualizar os achados, sem tocar no layout.

| Arquivo | Conteúdo |
| --- | --- |
| `findings.py` | Achados, pontos fortes, pontos fracos, escopo, metodologia e recomendações |
| `issues.py` | Texto completo das issues do GitHub, em Markdown |
| `gerar_relatorio.py` | Diagramação, gráficos e montagem do PDF |

## Escopo da rodada de 20/08/2026

65 arquivos versionados, cerca de 3.900 linhas, mais o histórico completo do git
e o bundle JavaScript publicado em produção. Foram mapeadas as cinco categorias
solicitadas para o equivalente real desta stack (RLS do Supabase, Edge Functions,
servidor Express de desenvolvimento, SSG e workflows).

Resultado: 8 achados (2 de severidade alta, 1 média, 3 baixas, 2 informativas) e
16 controles verificados como corretos. Nenhuma falha crítica.

## Limitação conhecida desta execução

A verificação direta do RLS contra o banco em produção não pôde ser concluída: o
DNS da rede local respondeu "domínio inexistente" para `supabase.co`, bloqueando
tanto a consulta SQL quanto o teste de escrita com a chave anon. Está registrado
como achado A-08 e deve ser refeito com DNS funcional.
