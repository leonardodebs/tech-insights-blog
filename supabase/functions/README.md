# Edge Functions

Código das funções serverless do projeto, agora sob controle de versão (achado 05.2 da auditoria de segurança: o componente de maior privilégio do sistema estava sem histórico, revisão ou auditabilidade).

## Correção que estas funções implementam

O achado **05.1** da auditoria apontou ausência de autorização: o portão do painel no cliente verifica apenas *existência de sessão*, sem checagem de papel. Com o cadastro público habilitado e a confirmação de e-mail desativada, qualquer pessoa podia se registrar e **ver a interface administrativa**.

**Revisão do achado (24/07/2026):** a existência do secret `ADMIN_EMAILS` desde 18/03/2026 indica que as funções anteriormente deployadas **provavelmente já implementavam alguma allowlist**. Como o código não estava versionado, isso não era verificável — a auditoria classificou corretamente a autorização do backend como *"não verificável"*, não como comprovadamente ausente. O que estava **confirmado** era a exposição da interface no cliente.

O ganho real deste versionamento, portanto, é menos "criar a autorização" e mais:

- Tornar a lógica de autorização **explícita e auditável**, com histórico e revisão
- Garantir política **fail closed** (configuração ausente nega acesso, nunca libera)
- Restringir **CORS** a uma origem única em vez de `*`
- Validar o formato de `postId` antes de repassá-lo ao workflow, que o consome em shell/jq
- Impor **limite de taxa** no disparo que gera custo na API Anthropic

| Função | O que protege |
|---|---|
| `manage-posts` | Exclusão de post. Recebe `postId` do cliente, então valida o formato antes de repassar ao workflow (defesa contra injeção de argumento) |
| `trigger-blog-post` | Geração manual de post. Abuso gera custo direto na API Anthropic, por isso tem limite de taxa por admin |

## Secrets

Confirmados no dashboard do projeto em 24/07/2026:

| Variável | Uso | Estado |
|---|---|---|
| `GITHUB_PAT` | PAT com escopo `actions:write` para disparar workflows | ✅ Já existe (18/03/2026) |
| `ADMIN_EMAILS` | Allowlist de admins, separada por vírgula | ✅ Já existe (18/03/2026) — confirmar o valor |
| `GITHUB_REPO` | Opcional. Padrão: `leonardodebs/tech-insights-blog` | — |
| `GITHUB_REF` | Opcional. Padrão: `main` | — |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Injetados automaticamente pela plataforma | Não criar manualmente |

O `guard.ts` lê `GITHUB_PAT` e mantém fallback para `GITHUB_TOKEN`, para não quebrar caso o secret seja renomeado no futuro.

> **Política fail closed:** se `ADMIN_EMAILS` estiver vazio ou não contiver seu e-mail, e sua conta não tiver `app_metadata.role = "admin"`, **todo acesso é negado — inclusive o seu**. Isso é intencional: configuração ausente nunca deve liberar acesso. Como o valor de um secret não é legível de volta (só o digest SHA-256), reescreva-o para ter certeza do conteúdo:
>
> ```bash
> npx supabase secrets set ADMIN_EMAILS="leonardodebs@gmail.com"
> ```

## Deploy

```bash
# uma vez
npx supabase login
npx supabase link --project-ref vxjcsahpwdxdqqwwwyph

# reescrever a allowlist para garantir o conteúdo (o valor não é legível de volta)
npx supabase secrets set ADMIN_EMAILS="leonardodebs@gmail.com"

# publicar
npx supabase functions deploy manage-posts
npx supabase functions deploy trigger-blog-post
```

> Estas funções **substituem** as versões atualmente deployadas. Como o código anterior não está disponível para comparação, teste o painel após o deploy (gerar post e excluir um post de teste) para confirmar que o comportamento se manteve.

## Opção mais robusta: papel em `app_metadata`

A allowlist por e-mail é prática, mas depende de um valor que pode mudar. O critério preferido é o papel em `app_metadata`, que **o próprio usuário não consegue alterar** (só a `service_role`). Para marcar sua conta:

```sql
-- SQL Editor do Supabase
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
where email = 'leonardodebs@gmail.com';
```

Depois disso, faça logout e login novamente para o JWT ser reemitido com o novo claim. Com o papel definido, a `ADMIN_EMAILS` passa a ser apenas redundância de segurança.

## Verificação após o deploy

```bash
# 1. Sem token: deve responder 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://vxjcsahpwdxdqqwwwyph.supabase.co/functions/v1/manage-posts

# 2. CORS: origem não autorizada não deve receber Access-Control-Allow-Origin
curl -sI -X OPTIONS -H "Origin: https://evil.example" \
  https://vxjcsahpwdxdqqwwwyph.supabase.co/functions/v1/manage-posts \
  | grep -i "access-control-allow-origin"

# 3. No painel logado: gerar post deve funcionar; disparar duas vezes
#    seguidas deve retornar 429 na segunda.
```

Se o item 1 responder algo diferente de 401, a guarda não está ativa — não prossiga.

## Limitações conhecidas

- **Limite de taxa em memória**: o estado do `trigger-blog-post` não é compartilhado entre instâncias nem sobrevive a cold start. Contém abuso trivial, não é controle rígido. Um limite durável exigiria tabela no Postgres registrando a última execução por usuário.
- **CORS fixo em `https://leonardodebs.github.io`**: ao migrar para domínio próprio (semana 2 do roadmap), atualizar `ALLOWED_ORIGIN` em `_shared/guard.ts`.
