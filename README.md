<div align="center">
  <h1>⚡ TechPulse AI</h1>
  <p><i>Blog técnico que gera, publica e distribui análises de tecnologia automaticamente, todos os dias, sem intervenção manual.</i></p>

  <p>
    <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" />
    <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white" />
    <img alt="TailwindCSS" src="https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
    <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
    <img alt="Claude" src="https://img.shields.io/badge/Claude-Haiku%204.5-D97757?style=flat-square&logo=anthropic&logoColor=white" />
    <img alt="GitHub Actions" src="https://img.shields.io/badge/GitHub_Actions-CI%2FCD-2088FF?style=flat-square&logo=githubactions&logoColor=white" />
  </p>

  <p><a href="https://leonardodebs.github.io/tech-insights-blog/">🌐 Ver o blog ao vivo</a></p>
</div>

---

## 📖 Visão Geral

O **TechPulse AI** transforma feeds RSS de fontes técnicas de referência em análises aprofundadas, escritas com o ângulo de um engenheiro sênior: foco em trade-offs de arquitetura, sem jargão de marketing.

Todo dia às **18:00 (BRT)**, um único workflow executa o ciclo completo:

```
Feeds RSS → Claude gera o artigo → Quality Gate → posts.json + Supabase
                                                        ↓
                              Build com SSG → Deploy GitHub Pages
                                                        ↓
                                          Publicação no LinkedIn
```

Nenhuma etapa exige ação manual. Se algo falhar, uma Issue é aberta automaticamente no repositório com o diagnóstico.

---

## ✨ Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| **🤖 Motor de IA** | **Claude Haiku 4.5** (`@anthropic-ai/sdk`) via *tool use*, que garante JSON estruturalmente válido em toda resposta |
| **🎯 Rotação de categorias** | A cada execução escolhe a categoria menos publicada nos últimos 21 posts, evitando concentração em um só tema |
| **📡 RSS por categoria** | Feeds segmentados por tema, priorizando as fontes da categoria alvo do dia + feeds gerais como complemento |
| **🛡️ Quality Gate** | Valida tamanho mínimo, seções obrigatórias, termos técnicos, ausência de jargão de marketing, travessão e fontes com link real |
| **🔁 Retry com feedback** | Até **5 tentativas**; cada reprovação devolve ao modelo o motivo exato para correção na tentativa seguinte |
| **🔗 Fontes com link** | Cada fonte citada vira link markdown real para o artigo original, usando a URL vinda do feed |
| **💼 Cross-post LinkedIn** | Publica automaticamente no LinkedIn com legenda própria para a rede, hashtags e link para o artigo |
| **🔍 SEO / SSG** | Gera página HTML estática por post com o conteúdo pré-renderizado, meta tags OG e canonical |
| **🗺️ Sitemap + RSS** | `sitemap-posts.xml` e `rss.xml` regerados a cada build |
| **📊 Google Analytics** | GA4 integrado, vinculado ao Google Search Console |
| **🔐 Painel Admin** | Área restrita via **Supabase Auth** para acompanhar stats e gerenciar posts |
| **🌓 Dark/Light Mode** | Tema alternável com persistência via `ThemeContext` |
| **📱 Responsivo** | Layout adaptado para mobile com menu hamburguer animado |

---

## 🧠 Motor de IA: Como Funciona

```
[Escolhe categoria menos publicada nos últimos 21 posts]
      ↓
[Feeds RSS da categoria + feeds gerais → título, resumo e URL de cada notícia]
      ↓
[Claude Haiku 4.5, tool "publish_post" com schema obrigatório]
      ↓
[title, excerpt, category, tags, content, linkedinCaption, linkedinHashtags]
      ↓
[Quality Gate ─ reprovou? devolve os motivos e tenta de novo (até 5x)]
      ↓
[posts.json + Supabase]
      ↓
[Build SSG → GitHub Pages] + [Publicação no LinkedIn]
```

### Quality Gate: o que reprova um artigo

| Regra | Critério |
|---|---|
| Tamanho | Mínimo de 1500 caracteres |
| Terminologia | Precisa conter termos técnicos reconhecíveis |
| Jargão proibido | "está crescendo", "cada vez mais", "revolucionário", "líder de mercado", entre outros |
| Travessão | O caractere de travessão é banido em todos os campos de texto |
| Conclusão | Seção `## Conclusão direta` obrigatória, terminando em pergunta |
| Fontes | Seção `## Fontes` obrigatória, com todas as entradas em formato de link markdown real |

Quando uma tentativa é reprovada, os motivos são reenviados ao modelo na tentativa seguinte, em vez de simplesmente repetir o mesmo prompt.

---

## 🏗️ Arquitetura

```
tech-insights-blog/
├── src/
│   ├── App.tsx                    # SPA principal (lista, detalhe, busca, filtros)
│   ├── main.tsx                   # Entrypoint + HashRouter
│   ├── components/
│   │   ├── Layout.tsx             # Header (nav por categoria, dark mode), Footer
│   │   ├── PostCard.tsx           # Card de post na listagem
│   │   └── Toast.tsx              # Notificações de sucesso/erro
│   ├── pages/
│   │   ├── AdminLogin.tsx         # Login via Supabase Auth
│   │   ├── AdminPage.tsx          # Roteamento da área admin
│   │   └── AdminPanel.tsx         # Dashboard: stats, gerar post, gerenciar acervo
│   ├── services/
│   │   ├── automation.ts          # Motor de IA: RSS → Claude → Quality Gate → posts.json
│   │   └── linkedin.ts            # Publicação via LinkedIn Posts API
│   ├── contexts/ThemeContext.tsx  # Provider de dark/light mode
│   ├── lib/supabase.ts            # Client Supabase configurado via env
│   ├── data/posts.json            # Acervo de artigos (fonte de verdade do build)
│   ├── types.ts                   # Interface Post
│   └── __tests__/                 # Testes (Vitest) de automation e linkedin
├── scripts/
│   ├── generate-sitemap.ts        # Gera dist/sitemap-posts.xml
│   ├── generate-rss.ts            # Gera dist/rss.xml (20 posts mais recentes)
│   ├── generate-post-pages.ts     # SSG: HTML por post com conteúdo pré-renderizado
│   ├── post-to-linkedin.ts        # Publica o post mais recente no LinkedIn
│   └── migrate-posts-to-supabase.ts
├── supabase/schema.sql            # Schema da tabela posts
├── server.ts                      # Express local: meta injection + Vite middleware
├── .github/workflows/
│   ├── auto-blog.yml              # Cron diário: gerar → LinkedIn → build → deploy
│   ├── manage-posts.yml           # Manual: excluir post por ID → rebuild → deploy
│   └── deploy.yml                 # Deploy a cada push na main
├── public/robots.txt
├── vite.config.ts                 # base: '/tech-insights-blog/'
└── package.json
```

---

## 🔍 SEO e Indexação

O site é uma SPA React, o que por padrão entrega ao Googlebot um HTML vazio. Para resolver isso, o build executa o `generate-post-pages.ts`, que:

- Renderiza o markdown do artigo para HTML e injeta dentro de `<div id="root">`, então o Googlebot recebe o **texto real do post** sem precisar executar JavaScript. Ao montar, o React (`createRoot`) substitui o conteúdo pelo app normal.
- Injeta `<title>`, `description`, meta tags Open Graph/Twitter e `canonical` por post.
- Adiciona links estáticos para todos os posts na homepage, permitindo que o crawler descubra cada URL a partir da página inicial.

URL de um post: `https://leonardodebs.github.io/tech-insights-blog/posts/{id}/`

---

## 💼 Integração com o LinkedIn

Na mesma chamada em que gera o artigo, o Claude também produz `linkedinCaption` (legenda adaptada ao formato da rede: gancho nas primeiras linhas, parágrafos curtos, sem markdown) e `linkedinHashtags`. Isso evita uma segunda chamada à API.

O `linkedin.ts` monta o post e publica via `POST /rest/posts`. A legenda passa por escape do **little text format** do LinkedIn, onde caracteres como `( ) [ ] { } @ #` são reservados para sintaxe de menção e precisam ser escapados, sob risco do texto ser truncado silenciosamente.

> ⚠️ **Manutenção periódica**: o `LINKEDIN_ACCESS_TOKEN` expira a cada **~60 dias** e o app não emite refresh token nesta configuração. Quando expirar, é preciso refazer a autorização OAuth manualmente e atualizar o secret. A falha aparece como Issue automática no repositório.

---

## 🛠️ Stack Tecnológica

### Frontend
| Tecnologia | Versão | Uso |
|---|---|---|
| React | 19 | Framework principal |
| Vite | 6 | Bundler e dev server |
| TailwindCSS | 4 | Estilização utility-first |
| Motion (Framer) | 12 | Animações e transições |
| React Router DOM | 7 | Roteamento SPA (HashRouter) |
| React Markdown | 10 | Renderização de Markdown + HTML raw |
| Lucide React | 0.546 | Ícones |
| Supabase JS | 2 | Autenticação e banco de dados |
| date-fns | 4 | Formatação de datas |
| DOMPurify | 3 | Sanitização de HTML |

### Backend / Automação
| Tecnologia | Versão | Uso |
|---|---|---|
| `@anthropic-ai/sdk` | 0.98 | SDK oficial da Claude API |
| `rss-parser` | 3.13 | Parsing de feeds RSS |
| `marked` | 18 | Markdown → HTML no build (SSG) |
| Express | 4 | Servidor HTTP local |
| Helmet | 8 | Security headers |
| `tsx` | 4 | Execução de TypeScript no Node |
| Vitest | 2 | Testes unitários |
| GitHub Actions | n/a | CI/CD e automação de conteúdo |

---

## ⚙️ GitHub Actions Workflows

### `auto-blog.yml`: Ciclo Diário Completo
- **Trigger**: `cron '0 21 * * *'` (18:00 BRT) + `workflow_dispatch`
- **Passos**: Checkout → Install → `runAutomation()` → **Post no LinkedIn** → Build → Commit `posts.json` → Deploy para GitHub Pages
- **Resiliência**: as etapas de geração e de LinkedIn usam `continue-on-error`, então uma falha nelas nunca derruba o build/deploy do site. Falhas abrem uma Issue com o diagnóstico (sem duplicar issue no mesmo dia).

### `manage-posts.yml`: Gerenciamento Manual
- **Trigger**: `workflow_dispatch` com inputs `action` e `postId`
- **Passos**: Remove post via `jq` → Build → Commit → Deploy

### `deploy.yml`: Deploy Padrão
- **Trigger**: Push na branch `main`
- **Passos**: Checkout → Install → Build → Deploy para GitHub Pages

---

## 🔐 Secrets Necessários

| Secret | Descrição |
|---|---|
| `ANTHROPIC_API_KEY` | Chave da Claude API ([console.anthropic.com](https://console.anthropic.com)) |
| `LINKEDIN_ACCESS_TOKEN` | Token OAuth do LinkedIn (expira em ~60 dias) |
| `LINKEDIN_PERSON_URN` | URN do perfil autor das publicações (`urn:li:person:...`) |
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima do Supabase (exposta ao browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço do Supabase (uso exclusivo no backend) |

---

## 🚀 Rodando Localmente

```bash
git clone https://github.com/leonardodebs/tech-insights-blog
cd tech-insights-blog
npm install

# Configure as variáveis de ambiente
cp .env.example .env

# Servidor de desenvolvimento (http://localhost:3000)
npm run dev

# Build de produção (inclui sitemap, RSS e SSG das páginas de post)
npm run build

# Verificação de tipos
npm run lint

# Testes
npm test
```

### Testando a publicação no LinkedIn sem publicar de verdade

```bash
LINKEDIN_DRY_RUN=true npx tsx scripts/post-to-linkedin.ts
```

Mostra no console exatamente o payload que seria enviado, sem chamar a API.

---

## 📡 Fontes RSS por Categoria

| Categoria | Fontes |
|---|---|
| **Cloud** | AWS Blog, Azure Blog, Google Cloud Blog, InfoQ Cloud |
| **AI** | OpenAI News, VentureBeat AI, MIT Technology Review, Ars Technica |
| **Security** | BleepingComputer, Dark Reading, Krebs on Security |
| **DevOps** | Kubernetes Blog, DevOps.com, InfoQ DevOps |
| **Observability** | Grafana Blog, OpenTelemetry Blog, CNCF Blog |
| **Startups** | TechCrunch Startups, Wired Business, Tecnoblog |
| **Open Source** | GitHub Blog, Opensource.com, Linux.com, CNCF Blog |

---

## 🤝 Créditos

- **Idealização e Autor**: Leonardo Pereira Debs
- **Contato**: [leonardodebs@gmail.com](mailto:leonardodebs@gmail.com) · [GitHub](https://github.com/leonardodebs) · [LinkedIn](https://www.linkedin.com/in/leonardodebs/)

---

© 2026 TechPulse AI. Built with Claude & React.
