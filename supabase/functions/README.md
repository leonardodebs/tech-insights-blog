# Edge Functions

Código das funções serverless do projeto, agora sob controle de versão (achado 05.2 da auditoria de segurança: o componente de maior privilégio do sistema estava sem histórico, revisão ou auditabilidade).

## Correção que estas funções implementam

O achado crítico **05.1** era ausência de autorização: as funções validavam apenas que o JWT era válido (autenticação) e tratavam **qualquer usuário autenticado como administrador**. Com o cadastro público habilitado no projeto, qualquer pessoa podia se registrar e operar o painel.

O módulo `_shared/guard.ts` corrige isso com dois critérios de autorização e política **fail closed**: se a allowlist não estiver configurada e o usuário não tiver o papel de admin, o acesso é negado.

| Função | O que protege |
|---|---|
| `manage-posts` | Exclusão de post. Recebe `postId` do cliente, então valida o formato antes de repassar ao workflow (defesa contra injeção de argumento) |
| `trigger-blog-post` | Geração manual de post. Abuso gera custo direto na API Anthropic, por isso tem limite de taxa por admin |

## ⚠️ Antes de fazer deploy: confirmar os nomes dos secrets

Estas funções foram escritas a partir da interface observada no cliente, porque **o código anterior não estava no repositório**. Antes de publicar, confirme no dashboard (*Edge Functions → Secrets*) como os secrets existentes se chamam e ajuste se necessário:

| Variável esperada | Uso | Observação |
|---|---|---|
| `GITHUB_TOKEN` | PAT com escopo `actions:write` para disparar workflows | **Verifique o nome real.** Pode estar como `GH_PAT`, `GH_TOKEN` etc. Se diferir, renomeie o secret ou ajuste `guard.ts` |
| `ADMIN_EMAILS` | Allowlist de admins, separada por vírgula | **Novo.** Precisa ser criado: `leonardodebs@gmail.com` |
| `GITHUB_REPO` | Opcional. Padrão: `leonardodebs/tech-insights-blog` | |
| `GITHUB_REF` | Opcional. Padrão: `main` | |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Injetados automaticamente pela plataforma | Não criar manualmente |

> Se `ADMIN_EMAILS` não for configurado e o usuário não tiver `app_metadata.role = "admin"`, **todo acesso é negado** — inclusive o seu. Isso é intencional: configuração ausente nunca deve liberar acesso.

## Deploy

```bash
# uma vez
npx supabase login
npx supabase link --project-ref vxjcsahpwdxdqqwwwyph

# criar a allowlist de admin
npx supabase secrets set ADMIN_EMAILS="leonardodebs@gmail.com"

# publicar
npx supabase functions deploy manage-posts
npx supabase functions deploy trigger-blog-post
```

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
