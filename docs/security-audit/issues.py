"""
Texto completo das issues do GitHub, em Markdown, prontas para copiar e colar.

Achados triviais do mesmo tema foram agrupados numa issue só (o caso do
servidor de desenvolvimento) para não gerar spam de issues.
"""

ISSUES = [
    {
        "n": 1,
        "titulo": "[Segurança] MFA é verificado apenas no navegador; Edge Functions aceitam sessão aal1",
        "labels": "security, alta",
        "md": """## Problema

O gate de MFA existe somente no cliente. `AdminPage.tsx` bloqueia a interface quando a sessão está em `aal1`, mas `requireAdmin` nas Edge Functions valida apenas a assinatura do JWT e o papel de administrador. O Assurance Level nunca é consultado.

Na prática, quem tem a senha do administrador obtém um token `aal1` direto na API de autenticação e chama `manage-posts` ou `trigger-blog-post` sem nunca digitar o código TOTP. Isso anula o controle de MFA implantado na rodada anterior da auditoria.

## Evidência

`supabase/functions/_shared/guard.ts:55-101`

```ts
const { data, error } = await supabase.auth.getUser();
if (error || !data?.user) return { error: jsonResponse({ error: "Não autorizado." }, 401) };

const role = (user.app_metadata as Record<string, unknown> | null)?.role;
const hasAdminRole = role === "admin";
const inAllowlist = email.length > 0 && allowlist.includes(email);

if (!hasAdminRole && !inAllowlist) {
  return { error: jsonResponse({ error: "Acesso negado." }, 403) };
}
// nenhuma verificação de aal2 em nenhum ponto do arquivo
```

Contraste com o gate do cliente, que faz a checagem corretamente:

`src/lib/useMfa.ts:33-39` e `src/pages/AdminPage.tsx:60-62`

```tsx
if (mfa.state === 'needs-challenge') {
  return <MfaChallenge onVerified={() => refreshMfa()} onCancel={handleLogout} />;
}
```

## Impacto

Bypass completo do segundo fator nas duas operações privilegiadas: exclusão de posts e disparo da geração (que consome crédito da API da Anthropic).

## Sugestão de correção

Em `requireAdmin`, ler a claim `aal` do JWT do chamador e recusar com 403 quando o usuário possuir fator TOTP verificado e a sessão estiver em `aal1`.

```ts
// após validar o usuário
const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== 'aal2') {
  return { error: jsonResponse({ error: "Segundo fator obrigatório." }, 403) };
}
```

## Critérios de aceite

- [ ] `requireAdmin` recusa com 403 uma sessão `aal1` de usuário com fator TOTP verificado
- [ ] `requireAdmin` continua aceitando sessão `aal2` de administrador
- [ ] Usuário sem fator cadastrado continua funcionando (não quebra o fluxo atual)
- [ ] Teste automatizado cobrindo os três casos acima
- [ ] Verificado em produção: token `aal1` recebe 403 em `manage-posts`
""",
    },
    {
        "n": 2,
        "titulo": "[Segurança] XSS refletido no server.ts: cabeçalho Host e URL entram sem escape nas meta tags",
        "labels": "security, alta",
        "md": """## Problema

Ao injetar as meta tags de compartilhamento, `server.ts` escapa corretamente o título e o resumo do post, mas insere `req.get('host')` e `req.originalUrl` **sem nenhum tratamento** dentro de um atributo HTML. Ambos são controlados por quem faz a requisição.

Um `Host` contendo aspas escapa do atributo `content` e injeta markup arbitrário na página.

## Evidência

`server.ts:106-107` (o escape correto, para comparação):

```ts
const safeTitle = he.encode(post.title);
const safeExcerpt = he.encode(post.excerpt);
```

`server.ts:114` e `server.ts:117` (sem escape):

```ts
html = html.replace(/<meta property="og:url" content=".*?" \\/>/,
  `<meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}" />`);

html = html.replace(/<meta property="twitter:url" content=".*?" \\/>/,
  `<meta property="twitter:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}" />`);
```

Confirmado que `index.html:30` e `index.html:37` contêm exatamente as tags que a regex substitui, portanto a injeção encontra alvo.

## Impacto

Execução de JavaScript no contexto da página. Como a sessão do Supabase fica em `localStorage`, um administrador que abrisse uma URL manipulada teria o token roubado.

## Condição de explorabilidade

`server.ts` é o servidor de desenvolvimento (`npm run dev`) e não é publicado no GitHub Pages. A exposição real vem de o processo escutar em `0.0.0.0` (ver issue 3), o que o torna alcançável por toda a rede local.

## Sugestão de correção

Escapar a URL da mesma forma que o título, ou preferencialmente montar a URL canônica a partir de uma constante do servidor em vez de refletir o `Host` do cliente.

```ts
const canonical = he.encode(`${BASE_URL}${req.originalUrl}`);
```

## Critérios de aceite

- [ ] `Host` e `originalUrl` não chegam ao HTML sem escape
- [ ] Requisição com `Host: x"><script>alert(1)</script>` não produz markup executável
- [ ] Título e resumo continuam escapados como já estão
- [ ] Teste cobrindo a tentativa de quebra de atributo
""",
    },
    {
        "n": 3,
        "titulo": "[Segurança] Endurecer o servidor de desenvolvimento: bind, stack trace e imagem de terceiro",
        "labels": "security, media",
        "md": """## Problema

Três problemas do mesmo arquivo, agrupados por serem do mesmo tema e terem a mesma correção de contexto.

**1. Escuta em todas as interfaces.** O servidor publica-se para toda a rede local, não apenas para a máquina do desenvolvedor, enquanto carrega `SUPABASE_SERVICE_ROLE_KEY` e `ANTHROPIC_API_KEY` no ambiente.

**2. Stack trace na resposta HTTP.** Sempre que `NODE_ENV` não for exatamente `production`, o stack completo volta no corpo, revelando caminhos absolutos e a estrutura do projeto. A condição é frágil: basta a variável não estar definida.

**3. Imagem de terceiro reintroduzida.** A auditoria anterior removeu o `picsum.photos` da produção por entregar o IP do visitante a um terceiro sem base legal. O servidor de desenvolvimento manteve a referência.

## Evidência

`server.ts:149`

```ts
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

`server.ts:72`

```ts
res.status(500).json({
  success: false,
  error: error.message || "Unknown error during automation",
  stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
});
```

`server.ts:120-122`

```ts
const imageUrl = `https://picsum.photos/seed/${post.id}/1200/630`;
```

## Impacto

O bind aberto transforma problemas locais em problemas de rede: amplia o alcance do XSS da issue 2 e do vazamento de stack trace de uma máquina para todo o segmento. A imagem de terceiro cria divergência com a política de privacidade publicada.

## Sugestão de correção

```ts
app.listen(PORT, "127.0.0.1", () => { ... });          // 1
console.error(error);                                   // 2: log no servidor, nunca na resposta
const imageUrl = `${BASE_URL}/og/default.png`;          // 3: mesma imagem da produção
```

## Critérios de aceite

- [ ] Servidor responde em `127.0.0.1:3000` e não responde pelo IP de rede da máquina
- [ ] Resposta de erro 500 não contém o campo `stack` em nenhum valor de `NODE_ENV`
- [ ] Nenhuma referência a `picsum.photos` permanece no repositório
- [ ] `grep -rn "picsum" .` retorna vazio
""",
    },
    {
        "n": 4,
        "titulo": "[Segurança] Painel admin renderiza para qualquer usuário autenticado, sem checar papel",
        "labels": "security, baixa",
        "md": """## Problema

O gate do painel verifica apenas se existe sessão, não se o usuário é administrador. Qualquer conta autenticada no projeto Supabase renderiza a interface completa, incluindo os botões de gerar e excluir post.

O impacto é contido porque o servidor bloqueia as ações com 403 e a lista de posts já é pública, mas a interface promete um privilégio que o usuário não tem, e isso é uma pista útil para quem estiver sondando o sistema.

## Evidência

`src/pages/AdminPage.tsx:51`

```tsx
// Sem sessão -> login por senha.
if (!session) {
  return <AdminLogin onLogin={() => refreshMfa()} />;
}
// qualquer usuário autenticado prossegue para o painel
```

## Impacto

Exposição de interface administrativa a usuários não privilegiados. Sem perda ou alteração de dados, já que a autorização do servidor permanece efetiva.

## Condição de explorabilidade

Só é alcançável se o cadastro público estiver habilitado no projeto Supabase.

## Sugestão de correção

Consultar o papel do usuário antes de renderizar `AdminPanel`, exibindo uma tela de acesso negado caso contrário. A checagem do servidor continua sendo a autoridade final; esta é apenas para coerência de interface.

## Critérios de aceite

- [ ] Usuário autenticado sem papel de admin recebe tela de acesso negado, não o painel
- [ ] Administrador continua acessando normalmente
- [ ] A verificação do servidor permanece intacta (não é substituída pela do cliente)
- [ ] Confirmado que o cadastro público está desabilitado no projeto Supabase
""",
    },
    {
        "n": 5,
        "titulo": "[Segurança] Fechar lacunas de verificação: RLS em produção e comparação de token",
        "labels": "security, informativa",
        "md": """## Problema

Dois itens menores levantados durante a auditoria, agrupados por serem ambos de baixo risco e de natureza verificatória.

**1. RLS de produção não confirmado.** O schema versionado está correto, mas a verificação direta contra o banco falhou porque o DNS da rede local respondeu "domínio inexistente" para `supabase.co`. Dado o precedente do achado B-01 da rodada anterior, em que uma Edge Function em produção divergia do repositório por meses, não se deve assumir equivalência sem provar.

**2. Comparação de token sem tempo constante.** O operador `!==` interrompe na primeira diferença. Na prática o ruído de rede torna o ataque impraticável num servidor local, mas a correção é trivial.

## Evidência

`supabase/schema.sql:19-28`

```sql
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON posts FOR SELECT USING (true);
CREATE POLICY "Service write" ON posts FOR ALL USING (auth.role() = 'service_role');
```

`server.ts:44`

```ts
if (!expected || req.get("x-automation-token") !== expected) {
```

## Impacto

Nenhum impacto conhecido. O primeiro item é lacuna de cobertura da auditoria; o segundo é teórico.

## Sugestão de correção

Para o RLS, executar com DNS funcional:

```bash
# deve retornar rowsecurity = true
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';

# com a chave anon, todas devem ser recusadas
curl -X POST   -H "apikey: $ANON" -H "Authorization: Bearer $ANON"   -d '{"id":"teste"}' "$URL/rest/v1/posts"
```

Para o token, usar `crypto.timingSafeEqual` sobre buffers de mesmo tamanho.

## Critérios de aceite

- [ ] Confirmado por consulta que todas as tabelas públicas têm RLS habilitado
- [ ] Confirmado que INSERT, UPDATE e DELETE com a chave anon são recusados
- [ ] Comparação do token passa a usar tempo constante
- [ ] Resultado da verificação registrado neste repositório
""",
    },
]
