<div align="center">
  <h1>⚡ TechPulse AI</h1>
  <p><i>Blog técnico com geração automática de artigos via IA, curadoria de 18+ feeds RSS e painel administrativo seguro.</i></p>

  <p>
    <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" />
    <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white" />
    <img alt="TailwindCSS" src="https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
    <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Auth-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
    <img alt="Gemini" src="https://img.shields.io/badge/Gemini-2.5 Flash-4285F4?style=flat-square&logo=google&logoColor=white" />
    <img alt="GitHub Actions" src="https://img.shields.io/badge/GitHub_Actions-CI%2FCD-2088FF?style=flat-square&logo=githubactions&logoColor=white" />
  </p>
</div>

---

## 📖 Visão Geral

O **TechPulse AI** é uma plataforma de inteligência tecnológica que transforma feeds RSS globais em análises técnicas aprofundadas, automaticamente. O motor de IA monitora **18 fontes de elite** (AWS, Azure, GCP, OpenAI, Kubernetes, Dark Reading, TechCrunch, etc.) e produz artigos estruturados, sem clichês e com foco em impacto prático para profissionais de tecnologia.

O projeto opera em dois modos:

- **🌐 GitHub Pages** — Versão estática deployada automaticamente via GitHub Actions. Artigos gerados pela IA são commitados no `posts.json` e o site é rebuildado.
- **💻 Dev Local** — Express + Vite em modo SPA, com servidor local expondo API `POST /api/trigger-automation` para testes.

---

## ✨ Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| **🤖 Motor de IA** | Usa **Gemini 2.5 Flash** (`@google/genai`) para gerar análises técnicas com qualidade validada |
| **📡 RSS Intelligence** | Agrega até 5 itens de cada um dos **18 feeds** configurados e seleciona 15 aleatoriamente como contexto |
| **🛡️ Quality Gate** | Valida o artigo gerado: mínimo 1500 chars, seções obrigatórias, termos técnicos presentes, zero clichês |
| **🔄 Retry automático** | Até **3 tentativas** de geração; lança erro se nenhuma passar no quality gate |
| **📅 Automação diária** | GitHub Actions dispara às **08:00 (BRT) todos os dias** via `cron: '0 11 * * *'` |
| **🗂️ Retenção de 90 dias** | Posts com mais de 3 meses são automaticamente removidos do `posts.json` |
| **🔐 Painel Admin** | Área restrita via **Supabase Auth** para gerar e excluir posts manualmente |
| **📊 Log de Atividade** | Histórico de execuções salvo na tabela `automation_logs` do Supabase, atualizado a cada 30s |
| **🔗 Compartilhamento** | Links permanentes por post via `?post=ID`, Twitter e LinkedIn share integrados |
| **🌓 Dark/Light Mode** | Tema alternável com persistência via `ThemeContext` |
| **📱 Responsivo** | Layout adaptado para mobile com menu hamburguer animado |
| **🏷️ SEO Dinâmico** | Express injeta `<meta>` OG/Twitter por post no HTML antes de servir |

---

## 🏗️ Arquitetura

```
tech-insights-blog/
├── src/
│   ├── App.tsx               # SPA principal (lista + detalhe de post, busca, filtros)
│   ├── components/
│   │   ├── Layout.tsx        # Header (nav, dark mode), Footer
│   │   ├── PostCard.tsx      # Card de post na listagem
│   │   └── Toast.tsx         # Notificações de sucesso/erro
│   ├── pages/
│   │   ├── AdminLogin.tsx    # Formulário de login Supabase Auth
│   │   ├── AdminPage.tsx     # Roteamento da área admin
│   │   └── AdminPanel.tsx    # Dashboard: stats, gerar post, gerenciar acervo, logs
│   ├── services/
│   │   └── automation.ts     # Motor de IA: RSS parsing → Gemini → validação → posts.json
│   ├── contexts/
│   │   └── ThemeContext.tsx  # Provider de dark/light mode
│   ├── lib/
│   │   └── supabase.ts       # Client Supabase configurado via env
│   ├── data/
│   │   └── posts.json        # Banco de dados estático dos artigos (90 dias)
│   └── types.ts              # Interface Post
├── server.ts                 # Express: API trigger, meta injection, Vite middleware
├── .github/
│   └── workflows/
│       ├── auto-blog.yml     # Cron diário: gerar post → build → deploy → commit
│       ├── manage-posts.yml  # Manual: excluir post por ID → rebuild → deploy
│       └── deploy.yml        # Deploy padrão a cada push na main
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 🧠 Motor de IA — Como Funciona

```
[18 RSS Feeds] → [Parser (até 5 itens/feed)] → [Shuffle + Slice 15 itens]
      ↓
[Gemini 2.5 Flash — systemInstruction "Master Architect V5.5"]
      ↓
[JSON: title, excerpt, category, tags, content]
      ↓
[Quality Gate: seções? termos técnicos? tamanho mínimo? zero clichês?]
      ↓ (até 3 tentativas)
[Normalização de categoria: Cloud | Linux | AI | Security | DevOps | Startups]
      ↓
[posts.json atualizado + posts > 90 dias removidos]
```

---

## 🛠️ Stack Tecnológica

### Frontend
| Tecnologia | Versão | Uso |
|---|---|---|
| React | 19 | Framework principal |
| Vite | 6 | Bundler e dev server |
| TailwindCSS | 4 | Estilização utility-first |
| Motion (Framer) | 12 | Animações e transições |
| React Router DOM | 7 | Roteamento SPA |
| React Markdown | 10 | Renderização de Markdown + HTML raw |
| Lucide React | 0.546 | Ícones |
| Supabase JS | 2 | Autenticação e banco de dados |
| date-fns | 4 | Formatação de datas |

### Backend / Automação
| Tecnologia | Versão | Uso |
|---|---|---|
| Express | 4 | Servidor HTTP local |
| Helmet | 8 | Security headers |
| Compression | 1.8 | Compressão de resposta |
| `@google/genai` | 1.29 | SDK oficial Gemini API |
| `rss-parser` | 3.13 | Parsing de feeds RSS |
| `tsx` | 4 | Execução de TypeScript no Node |
| GitHub Actions | — | CI/CD e automação de conteúdo |

---

## ⚙️ GitHub Actions Workflows

### `auto-blog.yml` — Geração Diária
- **Trigger**: `cron '0 11 * * *'` (08:00 BRT) + `workflow_dispatch`
- **Passos**: Checkout → Install → `runAutomation()` com `GEMINI_API_KEY` → Build → Commit `posts.json` → Deploy para GitHub Pages

### `manage-posts.yml` — Gerenciamento Manual de Posts
- **Trigger**: `workflow_dispatch` com inputs `action` e `postId`
- **Passos**: Checkout → Remove post via `jq` → Install → Build → Commit → Deploy

### `deploy.yml` — Deploy Padrão
- **Trigger**: Push na branch `main`
- **Passos**: Checkout → Install → Build (com env Supabase) → Upload artifact → Deploy para GitHub Pages

---

## 🔐 Área Administrativa

Acesse em `/#/admin`. Protegida por **Supabase Auth** (email + senha).

**Funcionalidades do painel:**
- 📊 **Stats em tempo real**: total de posts ativos, categorias em uso, data da última publicação
- ⚡ **Gerar Agora**: dispara a Edge Function do Supabase que aciona o GitHub Actions via API
- 🗑️ **Excluir Posts**: remove post por ID via workflow `manage-posts.yml`
- 📋 **Log Global**: histórico das últimas 10 execuções da tabela `automation_logs` (atualizado a cada 30s)

**Segredos necessários no GitHub:**

| Secret | Descrição |
|---|---|
| `GEMINI_API_KEY` | Chave da API Google Gemini |
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima do Supabase |

---

## 🚀 Rodando Localmente

```bash
# Clone e instale
git clone https://github.com/leonardodebs/tech-insights-blog
cd tech-insights-blog
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Preencha: GEMINI_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

# Inicia servidor Express + Vite (desenvolvimento)
npm run dev

# Build de produção
npm run build
```

O servidor sobe em `http://localhost:3000`.

Para testar a geração de posts localmente via API:
```bash
curl -X POST http://localhost:3000/api/trigger-automation \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 📡 Fontes RSS Monitoradas

| Categoria | Fonte |
|---|---|
| Cloud | AWS Blog, Azure Blog, Google Cloud Blog |
| Linux / Open Source | Phoronix, ZDNet Linux |
| IA | OpenAI News, VentureBeat AI, MIT Technology Review |
| Segurança | BleepingComputer, Dark Reading, Krebs on Security |
| DevOps | Kubernetes Blog, DevOps.com, InfoQ Cloud |
| Startups / Mercado | TechCrunch Startups, Wired Business |
| Brasil | Tecnoblog, Ars Technica |

---

## 🤝 Créditos

- **Idealização e Autor**: Leonardo Pereira Debs
- **Arquitetura e Desenvolvimento**: Desenvolvido em colaboração com o **Google Antigravity** (Google DeepMind — Advanced Agentic Coding)
- **Contato**: [leonardodebs@gmail.com](mailto:leonardodebs@gmail.com) · [GitHub](https://github.com/leonardodebs)

---

© 2026 TechPulse AI. Built with Gemini & React.
