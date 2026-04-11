# 🛡️ Security Guardrails & Standard Operating Procedures (SOP)

Este documento define os padrões de segurança obrigatórios para todos os projetos desenvolvidos. **Estes padrões devem ser validados em cada ciclo de desenvolvimento.**

## 1. Proteção contra XSS (Cross-Site Scripting)

### Client-Side (Frontend)
- **Regra:** Nunca renderizar conteúdo dinâmico ou vindo de fontes externas (APIs, Markdown, User Input) sem sanitização.
- **Ferramenta Padrão:** `dompurify`.
- **Implementação:**
  ```tsx
  import DOMPurify from 'dompurify';
  const cleanHTML = DOMPurify.sanitize(dirtyContent);
  ```

### Server-Side (SSR/Injection)
- **Regra:** Todo dado injetado diretamente no HTML (Meta Tags, Títulos, JSON inicial) deve ser encodado para evitar quebra de tags.
- **Ferramenta Padrão:** `he` (HTML entities).
- **Implementação:**
  ```ts
  import he from 'he';
  const safeString = he.encode(inputString);
  ```

## 2. Gestão de Segredos e Credenciais

- **Git Hygiene:** Arquivos `.env` devem estar SEMPRE no `.gitignore`.
- **Exposição de Bundle:** Apenas variáveis com o prefixo `VITE_` (ou equivalente do framework) podem ir para o frontend. NUNCA use este prefixo para chaves privadas (OpenAI, Gemini Backend, Database Admin).
- **Modelo:** Sempre fornecer um `.env.example` sem valores reais.

## 3. Segurança de Banco de Dados (Supabase/PostgreSQL)

- **Row Level Security (RLS):** O RLS deve estar **ATIVO** para todas as tabelas no schema `public`.
- **Princípio do Menor Privilégio:** 
  - `anon`: Apenas permissões de leitura (`SELECT`) em tabelas públicas.
  - `authenticated`: Apenas para dados do próprio usuário ou ações administrativas.
- **Service Role:** A chave `service_role` NUNCA deve sair do servidor/backend.

## 4. Infraestrutura e Cabeçalhos

- **Helmet.js:** Deve ser usado em todos os servidores Node.js/Express.
- **Rate Limiting:** Rotas críticas (login, gatilhos de automação, webhooks) devem ter limite de requisições por IP.
- **Erro Handling:** Stack traces não devem ser exibidos em produção.

---

*Estes guardrails foram estabelecidos durante o projeto Tech-Insights-Blog e são a base de segurança para o ecossistema de projetos de Leonardo Debs.*
