"""
Dados da auditoria de segurança do TechPulse AI.

Separado do gerador de PDF de propósito: para reauditar, basta atualizar esta
lista e rodar gerar_relatorio.py de novo, sem mexer na diagramação.

Cada achado registra arquivo:linha e o trecho real do código, para que o
relatório seja verificável contra o repositório.
"""

PROJETO = "TechPulse AI (tech-insights-blog)"
REPO = "leonardodebs/tech-insights-blog"
DATA_AUDITORIA = "20 de agosto de 2026"

CORES = {
    "critica": "#B91C1C",
    "alta": "#EA580C",
    "media": "#D97706",
    "baixa": "#2563EB",
    "informativa": "#6B7280",
    "forte": "#059669",
}

ESCOPO = [
    "Frontend React 19 + Vite 6 (SPA, HashRouter, base /tech-insights-blog/)",
    "Supabase: Postgres com RLS, Auth (senha + TOTP), 2 Edge Functions (Deno)",
    "Servidor Express de desenvolvimento (server.ts)",
    "Scripts de build/SSG e automação de conteúdo (Claude API + LinkedIn)",
    "3 workflows do GitHub Actions e deploy no GitHub Pages",
    "Histórico completo do git e bundle JavaScript publicado em produção",
]

METODOLOGIA = [
    ("1. Banco sem tranca",
     "O mecanismo de isolamento deste projeto é o RLS do Supabase. Foram inspecionadas "
     "as policies em supabase/schema.sql, os advisors de segurança do próprio Supabase e "
     "todo acesso a tabela no código (6 pontos, uma única tabela: posts)."),
    ("2. Permissão no navegador",
     "Cada gate de papel do frontend (sessão, AAL/MFA) foi cruzado com o endpoint "
     "correspondente nas Edge Functions, verificando se o servidor repete a checagem."),
    ("3. IDOR",
     "Enumerados TODOS os 6 handlers de rota do backend (4 no Express, 2 Edge Functions), "
     "verificando se objetos acessados por ID validam posse/autorização."),
    ("4. Chaves expostas",
     "Varredura por padrões de segredo no código versionado, .env.example, workflows, "
     "histórico completo do git e bundle JS publicado, incluindo decodificação do JWT embutido."),
    ("5. Inputs sem tratamento",
     "Busca por dangerouslySetInnerHTML/innerHTML/eval no frontend, revisão do pipeline de "
     "markdown e de toda geração de HTML/XML no servidor e no SSG."),
]

ACHADOS = [
    {
        "id": "A-01",
        "sev": "alta",
        "cat": "2. Permissão no navegador",
        "titulo": "MFA é verificado apenas no navegador; servidor não exige AAL2",
        "arquivo": "supabase/functions/_shared/guard.ts:55-101",
        "arquivos_extra": ["src/lib/useMfa.ts:33-39", "src/pages/AdminPage.tsx:60-62"],
        "codigo": (
            "// guard.ts — requireAdmin valida assinatura e papel, mas NUNCA o AAL\n"
            "const { data, error } = await supabase.auth.getUser();\n"
            "const role = (user.app_metadata)?.role;\n"
            "const hasAdminRole = role === \"admin\";\n"
            "const inAllowlist = allowlist.includes(email);\n"
            "if (!hasAdminRole && !inAllowlist) return 403;   // <-- nenhuma checagem de aal2"
        ),
        "porque": (
            "O gate de MFA existe só no cliente: AdminPage.tsx bloqueia a interface quando a "
            "sessão está em aal1, mas as Edge Functions aceitam qualquer JWT válido de um e-mail "
            "admin, independentemente de o segundo fator ter sido cumprido. Um atacante de posse "
            "apenas da senha obtém um token aal1 direto na API de auth e chama manage-posts ou "
            "trigger-blog-post, excluindo posts ou queimando crédito da Anthropic sem nunca "
            "digitar o código TOTP. Isso anula o controle de MFA implantado na rodada anterior."
        ),
        "impacto": "Bypass completo do segundo fator nas duas operações privilegiadas do sistema.",
        "correcao": (
            "Em requireAdmin, ler a claim aal do JWT (ou chamar getAuthenticatorAssuranceLevel) e "
            "recusar com 403 quando o usuário possui fator TOTP verificado e a sessão está em aal1."
        ),
        "condicao": "Requer conhecimento da senha do admin. Não requer o dispositivo TOTP.",
    },
    {
        "id": "A-02",
        "sev": "alta",
        "cat": "5. Inputs sem tratamento",
        "titulo": "XSS refletido: cabeçalho Host e URL injetados sem escape nas meta tags",
        "arquivo": "server.ts:114,117",
        "arquivos_extra": ["index.html:30,37 (alvo da substituição)"],
        "codigo": (
            "// server.ts:106-107 — title e excerpt SÃO escapados\n"
            "const safeTitle = he.encode(post.title);\n"
            "const safeExcerpt = he.encode(post.excerpt);\n\n"
            "// server.ts:114 e 117 — host e URL entram CRUS no atributo content\n"
            "html = html.replace(/<meta property=\"og:url\" content=\".*?\" \\/>/,\n"
            "  `<meta property=\"og:url\" content=\"${req.protocol}://${req.get('host')}${req.originalUrl}\" />`);"
        ),
        "porque": (
            "req.get('host') e req.originalUrl são controlados por quem faz a requisição e vão "
            "direto para dentro de um atributo HTML sem escape. Basta um Host contendo aspas para "
            "escapar do atributo e injetar script na página. O contraste com as linhas 106-107, "
            "onde he.encode é corretamente aplicado, mostra que o escape foi esquecido nestas duas. "
            "Confirmado que index.html:30 e :37 contêm exatamente as tags que a regex substitui, "
            "portanto a injeção encontra alvo."
        ),
        "impacto": "Execução de JavaScript no contexto da página, com roubo da sessão do admin (guardada em localStorage).",
        "correcao": (
            "Aplicar he.encode também na URL, ou montar a URL canônica a partir de uma constante "
            "do próprio servidor em vez de refletir o Host enviado pelo cliente."
        ),
        "condicao": (
            "server.ts é o servidor de desenvolvimento (npm run dev), não é publicado no GitHub "
            "Pages. A exposição real vem de A-03: o processo escuta em 0.0.0.0."
        ),
    },
    {
        "id": "A-03",
        "sev": "media",
        "cat": "4. Chaves expostas",
        "titulo": "Servidor de desenvolvimento escuta em todas as interfaces com credenciais de produção no ambiente",
        "arquivo": "server.ts:149",
        "arquivos_extra": ["server.ts:43-49", "src/services/automation.ts:579-580"],
        "codigo": (
            "app.listen(PORT, \"0.0.0.0\", () => {\n"
            "  console.log(`Server running on http://localhost:${PORT}`);\n"
            "});"
        ),
        "porque": (
            "O bind em 0.0.0.0 publica o servidor para toda a rede local, não apenas para a "
            "máquina do desenvolvedor. Esse processo carrega SUPABASE_SERVICE_ROLE_KEY e "
            "ANTHROPIC_API_KEY no ambiente, e é o mesmo que expõe o XSS de A-03. Qualquer "
            "dispositivo na mesma rede alcança as rotas."
        ),
        "impacto": "Amplia o alcance do XSS (A-02) e do vazamento de stack trace (A-04) de local para toda a rede.",
        "correcao": "Trocar o bind para 127.0.0.1, que é o correto para um servidor de desenvolvimento.",
        "condicao": "Vale enquanto o servidor estiver rodando localmente (npm run dev).",
    },
    {
        "id": "A-04",
        "sev": "baixa",
        "cat": "5. Inputs sem tratamento",
        "titulo": "Stack trace devolvido ao cliente nas respostas de erro",
        "arquivo": "server.ts:72",
        "arquivos_extra": [],
        "codigo": (
            "res.status(500).json({\n"
            "  success: false,\n"
            "  error: error.message || \"Unknown error during automation\",\n"
            "  stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined\n"
            "});"
        ),
        "porque": (
            "Sempre que NODE_ENV não for exatamente 'production', o stack trace completo volta no "
            "corpo da resposta, revelando caminhos absolutos do sistema de arquivos e a estrutura "
            "interna do projeto. A condição é frágil: basta a variável não estar definida."
        ),
        "impacto": "Divulgação de informação que facilita o mapeamento do ambiente por um atacante.",
        "correcao": "Registrar o stack apenas no log do servidor e nunca no corpo da resposta HTTP.",
        "condicao": "Combinado com A-03, fica acessível a qualquer um na rede local.",
    },
    {
        "id": "A-05",
        "sev": "baixa",
        "cat": "2. Permissão no navegador",
        "titulo": "Painel administrativo liberado por existência de sessão, não por papel de admin",
        "arquivo": "src/pages/AdminPage.tsx:51",
        "arquivos_extra": ["src/pages/AdminPanel.tsx:51-65"],
        "codigo": (
            "// Sem sessão -> login por senha.\n"
            "if (!session) {\n"
            "  return <AdminLogin onLogin={() => refreshMfa()} />;\n"
            "}\n"
            "// ...qualquer usuário autenticado prossegue para o painel"
        ),
        "porque": (
            "A condição verifica apenas se existe sessão, não se o usuário é administrador. "
            "Qualquer conta autenticada no projeto Supabase renderiza a interface completa do "
            "painel, incluindo os botões de gerar e excluir post. O impacto é contido porque as "
            "ações são bloqueadas no servidor com 403 e a lista de posts já é pública, mas a "
            "interface sugere um privilégio que o usuário não tem."
        ),
        "impacto": "Exposição de interface administrativa a usuários não privilegiados. Sem perda de dados.",
        "correcao": (
            "Verificar o papel do usuário (app_metadata.role ou allowlist) antes de renderizar o "
            "painel, mantendo a checagem no servidor como autoridade final."
        ),
        "condicao": "Só é alcançável se o cadastro público estiver habilitado no projeto Supabase.",
    },
    {
        "id": "A-06",
        "sev": "baixa",
        "cat": "5. Inputs sem tratamento",
        "titulo": "Imagem de terceiro (picsum.photos) reintroduzida no servidor de desenvolvimento",
        "arquivo": "server.ts:120-122",
        "arquivos_extra": [],
        "codigo": (
            "const imageUrl = `https://picsum.photos/seed/${post.id}/1200/630`;\n"
            "html = html.replace(/<meta property=\"og:image\" content=\".*?\" \\/>/,\n"
            "  `<meta property=\"og:image\" content=\"${imageUrl}\" />`);"
        ),
        "porque": (
            "A auditoria anterior removeu o picsum.photos da produção justamente por entregar o IP "
            "do visitante a um terceiro sem base legal. O servidor de desenvolvimento manteve a "
            "referência, criando divergência entre o que a política de privacidade declara e o que "
            "este código faz."
        ),
        "impacto": "Vazamento de IP a terceiro e inconsistência com a política de privacidade publicada.",
        "correcao": "Apontar para a imagem própria em public/og/default.png, igual à produção.",
        "condicao": "Só afeta quem acessar via servidor de desenvolvimento.",
    },
    {
        "id": "A-07",
        "sev": "informativa",
        "cat": "4. Chaves expostas",
        "titulo": "Comparação de token sem tempo constante",
        "arquivo": "server.ts:44",
        "arquivos_extra": [],
        "codigo": (
            "const expected = process.env.LOCAL_AUTOMATION_TOKEN;\n"
            "if (!expected || req.get(\"x-automation-token\") !== expected) {"
        ),
        "porque": (
            "O operador !== interrompe na primeira diferença, o que teoricamente permite inferir o "
            "token byte a byte medindo o tempo de resposta. Na prática o ruído de rede num servidor "
            "local torna o ataque impraticável, e a guarda está corretamente fail-closed."
        ),
        "impacto": "Teórico. Registrado por completude.",
        "correcao": "Usar crypto.timingSafeEqual sobre buffers de mesmo tamanho.",
        "condicao": "Requer milhares de requisições e rede de latência estável.",
    },
    {
        "id": "A-08",
        "sev": "informativa",
        "cat": "1. Banco sem tranca",
        "titulo": "Estado do RLS em produção não pôde ser confirmado nesta execução",
        "arquivo": "supabase/schema.sql:19-28",
        "arquivos_extra": [],
        "codigo": (
            "ALTER TABLE posts ENABLE ROW LEVEL SECURITY;\n"
            "CREATE POLICY \"Public read\" ON posts FOR SELECT USING (true);\n"
            "CREATE POLICY \"Service write\" ON posts FOR ALL USING (auth.role() = 'service_role');"
        ),
        "porque": (
            "O schema versionado está correto. A verificação direta contra o banco em produção "
            "falhou porque o DNS da rede local (servidor homelab, 192.168.100.2) responde "
            "'domínio inexistente' para supabase.co, bloqueando tanto o SQL quanto o teste de "
            "escrita com a chave anon. Registrado como lacuna e não como falha porque os advisors "
            "de segurança do Supabase retornaram zero alertas, e eles sinalizam exatamente tabela "
            "pública sem RLS. O precedente do achado B-01 da rodada anterior (função em produção "
            "divergente do repositório) justifica não assumir equivalência sem provar."
        ),
        "impacto": "Nenhum impacto conhecido. É uma lacuna de cobertura da auditoria.",
        "correcao": (
            "Repetir com DNS funcional: SELECT sobre pg_policies e tentativa de INSERT/UPDATE/DELETE "
            "com a chave anon, que deve ser recusada."
        ),
        "condicao": "Depende apenas de resolver o DNS local para supabase.co.",
    },
]

PONTOS_FORTES = [
    ("RLS habilitado com política mínima",
     "supabase/schema.sql:19-28",
     "Leitura pública explícita e escrita restrita a service_role. Advisors de segurança do Supabase retornaram zero alertas."),
    ("Nenhum segredo no bundle publicado",
     "assets/index-Dm8EKp0Q.js (produção)",
     "O único JWT embutido decodifica para {\"role\":\"anon\"}, público por design. Zero ocorrências de service_role, chave Anthropic, token LinkedIn ou PAT."),
    ("Nenhum segredo hardcoded no repositório",
     ".env.example e todo o código versionado",
     "Somente placeholders. Varredura por padrões (sk-, ghp_, AKIA, AIza, chaves privadas) não encontrou nada."),
    ("Histórico do git limpo",
     "todos os commits desde a criação",
     "Nenhum arquivo .env ou de credencial commitado. A única correspondência suspeita (AQpD2UMJ...) foi verificada e é um hash sha512 de integridade do npm, falso positivo."),
    ("Pipeline de markdown na ordem correta",
     "src/App.tsx:342",
     "rehypeRaw converte o HTML bruto em AST e rehypeSanitize sanea em seguida. Inverter essa ordem foi o bug corrigido em rodada anterior; permanece correto."),
    ("SSG sanitiza o HTML pré-renderizado",
     "scripts/generate-post-pages.ts + src/lib/sanitizeHtml.ts",
     "A saída do marked passa pelo mesmo rehype-sanitize do SPA antes de entrar no HTML estático, com 4 testes de regressão."),
    ("Frontend sem primitivas perigosas",
     "todo o diretório src/",
     "Zero ocorrências de dangerouslySetInnerHTML, innerHTML, outerHTML, insertAdjacentHTML, eval, new Function ou document.write."),
    ("Edge Functions fail-closed",
     "supabase/functions/_shared/guard.ts:58-98",
     "Ausência de header, JWT inválido ou usuário fora da allowlist resultam em 401/403. Configuração ausente nega o acesso em vez de liberar."),
    ("CORS restrito a uma origem",
     "supabase/functions/_shared/guard.ts:16-23",
     "Access-Control-Allow-Origin fixo em https://leonardodebs.github.io, com Vary: Origin. Verificado em produção: origem maliciosa não é espelhada."),
    ("Identificador validado no servidor",
     "supabase/functions/manage-posts/index.ts:15,42-44",
     "POST_ID_PATTERN (^post-\\d{10,20}$) rejeita qualquer valor fora do formato antes de chegar ao workflow."),
    ("Workflows sem interpolação insegura",
     ".github/workflows/manage-posts.yml:34-35,75",
     "Inputs do usuário passam por env: e são usados como variáveis entre aspas, nunca interpolados no corpo do script. Há validação do formato no próprio workflow."),
    ("CSP sem unsafe-inline e sem unsafe-eval",
     "index.html",
     "default-src 'self', object-src 'none', base-uri 'self', form-action 'self'. Scripts inline foram extraídos para arquivo (public/consent-default.js)."),
    ("Login sem enumeração de usuário",
     "src/pages/AdminLogin.tsx:29",
     "Mensagem genérica 'Email ou senha incorretos.' para qualquer falha, sem distinguir usuário inexistente de senha errada."),
    ("Credenciais sempre por variável de ambiente",
     "src/services/automation.ts:579-580 e scripts/migrate-posts-to-supabase.ts:17-25",
     "Nenhum fallback com valor literal. O script de migração aborta se as variáveis não estiverem definidas."),
    ("Endpoint de automação fail-closed",
     "server.ts:43-49",
     "Exige LOCAL_AUTOMATION_TOKEN e nega o acesso quando a variável não está configurada, em vez de liberar."),
    ("Escape correto de título e resumo",
     "server.ts:106-107",
     "he.encode aplicado ao conteúdo vindo do post antes da injeção nas meta tags."),
]

PONTOS_FRACOS = [
    "O segundo fator protege a interface, não o servidor. Quem tem a senha do administrador "
    "alcança as duas operações privilegiadas por chamada direta à API, sem TOTP (A-01).",
    "O servidor de desenvolvimento concentra três problemas ao mesmo tempo: XSS refletido, "
    "stack trace na resposta e escuta em todas as interfaces, enquanto carrega a chave "
    "service_role e a chave da Anthropic no ambiente (A-02, A-03, A-04).",
    "Existe divergência entre a postura de produção e a do ambiente de desenvolvimento: "
    "correções aplicadas ao site publicado, como a remoção do picsum.photos, não foram "
    "replicadas no server.ts (A-06).",
]

RECOMENDACOES = [
    ("P1", "Exigir AAL2 no servidor",
     "Adicionar a verificação de Assurance Level em requireAdmin, recusando sessões aal1 quando "
     "houver fator TOTP verificado. Sem isso o MFA continua sendo apenas cosmético para a API.",
     ["A-01"]),
    ("P1", "Escapar host e URL no server.ts",
     "Aplicar he.encode nas linhas 114 e 117, ou usar uma URL canônica constante em vez de "
     "refletir o cabeçalho Host.",
     ["A-02"]),
    ("P2", "Restringir o servidor de desenvolvimento ao loopback",
     "Trocar o bind de 0.0.0.0 para 127.0.0.1 e remover o stack trace do corpo da resposta.",
     ["A-03", "A-04"]),
    ("P2", "Alinhar o dev server à produção",
     "Substituir o picsum.photos pela imagem própria já usada no site publicado.",
     ["A-06"]),
    ("P3", "Verificar papel antes de renderizar o painel",
     "Checar admin no cliente para não exibir interface privilegiada a quem não tem permissão, "
     "mantendo o servidor como autoridade.",
     ["A-05"]),
    ("P3", "Fechar as lacunas de verificação",
     "Repetir o teste de RLS contra o banco com DNS funcional e adotar comparação em tempo "
     "constante para o token local.",
     ["A-07", "A-08"]),
]
