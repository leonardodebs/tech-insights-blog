<div align="center">
  <h1>🚀 TechPulse AI: Hub de Inteligência Tecnológica</h1>
  <p><i>Artigos técnicos analíticos gerados por IA baseados em tendências globais de mercado em tempo real.</i></p>
</div>

---

## 📖 Visão Geral

O **TechPulse AI** (Tech Insights) é muito mais do que um simples blog. Ele é uma plataforma de **Inteligência Tecnológica** que transforma notícias brutas em análises profundas. Através de um motor de automação robusto, o site monitora os cenários de **Cloud, Linux, IA, Segurança, DevOps e Startups** para entregar conteúdos estruturados e prontos para o profissional moderno.

Este projeto utiliza **Groq (Llama 3.3 70B)** para processar feeds RSS globais e gerar relatórios técnicos em HTML puro através de um sistema **Serverless**, eliminando o ruído e focando no que realmente importa: **O impacto no mercado** e a **implementação prática**.

---

*   **🔍 Intelligence Gathering**: Monitoramento automático de **18+ fontes de elite** (AWS, OpenAI, Kubernetes, Azure, Tecnoblog, TechCrunch, etc).
*   **🧠 Motor de IA Sênior**: Utiliza o modelo **Llama 3.3 70B** via Groq para criar análises detalhadas, previsões de mercado e relatórios de "Inside Scoop".
*   **🔐 Painel Administrativo**: Área restrita segura em `/#/admin` protegida por **Supabase Auth** para gestão de posts.
*   **🎨 Design Premium**: Interface moderna construída com **TailwindCSS 4**, **Framer Motion** e suporte nativo a **Light/Dark Mode**.
*   **🛠️ Foco Técnico**: Artigos com exemplos reais de terminal e scripts, formatados em HTML semântico com "Quality Gate" de conteúdo.
*   **🛡️ Segurança Serverless**: 
    *   Autenticação via Supabase.
    *   API Keys protegidas em **Edge Functions** (nenhum segredo exposto no front).
    *   Disparo manual de workflows via GitHub API.
*   **📅 Automação 24/7**: Workflow integrado via **GitHub Actions** para atualização automática toda segunda-feira às 8h00 (BRT).

---

### Frontend
- **React 19**
- **Vite**
- **TailwindCSS 4**
- **Framer Motion** (Animações fluidas)
- **Supabase Auth** (Gestão de acesso)

### Backend / Serverless
- **Supabase Edge Functions** (TypeScript/Deno)
- **Groq SDK** (Llama 3.3 70B)
- **GitHub Actions** (Automação e Deploy)
- **RSS Parser**

---

---

## 🛡️ Área Administrativa

O projeto conta com um painel de controle restrito para o administrador gerenciar o blog:

- **Login**: Acesso via `/admin`.
- **Controle**: Visualização de estatísticas (total de posts, categorias).
- **Ação**: Botão exclusivo **"Gerar Post Agora"** que dispara manualmente o motor de IA via Supabase Edge Functions + GitHub API.

---

## 🤝 Créditos e Contribuições

Este projeto foi desenvolvido com foco em automação total e design de alta qualidade, unindo engenharia de software brasileira e inteligência artificial de ponta.

- **Idealização e Autor**: Leonardo Pereira Debs
- **Arquitetura e Desenvolvimento**: Desenvolvido e refinado em colaboração com o **Google Antigravity** (equipe da Google DeepMind utilizando Google Gemini através do motor Advanced Agentic Coding).

---
