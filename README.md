<div align="center">
  <h1>🚀 TechPulse AI: Hub de Inteligência Tecnológica</h1>
  <p><i>Artigos técnicos analíticos gerados por IA baseados em tendências globais de mercado em tempo real.</i></p>
</div>

---

## 📖 Visão Geral

O **TechPulse AI** (Tech Insights) é muito mais do que um simples blog. Ele é uma plataforma de **Inteligência Tecnológica** que transforma notícias brutas em análises profundas. Através de um motor de automação robusto, o site monitora os cenários de **Cloud, Linux, IA, Segurança, DevOps e Startups** para entregar conteúdos estruturados e prontos para o profissional moderno.

Este projeto utiliza **Groq (Llama 3.1)** para processar feeds RSS globais e gerar relatórios técnicos em HTML puro, eliminando o ruído e focando no que realmente importa: **O impacto no mercado** e a **implementação prática**.

---

## ✨ Funcionalidades Principais

*   **🔍 Intelligence Gathering**: Monitoramento automático de **18+ fontes de elite** (AWS, OpenAI, Kubernetes, Azure, Tecnoblog, TechCrunch, etc).
*   **🧠 Motor de IA Analítico**: Utiliza o modelo Llama 3.1 via Groq para criar análises detalhadas, previsões de mercado e relatórios de "Inside Scoop".
*   **🎨 Design Premium**: Interface moderna construída com **TailwindCSS 4**, **Framer Motion** e suporte nativo a **Light/Dark Mode**.
*   **🛠️ Foco Técnico**: Artigos com exemplos reais de terminal, arquivos de configuração e scripts, formatados em HTML semântico.
*   **🛡️ Segurança e Estabilidade**: 
    *   Rate limiting por IP no servidor.
    *   API Keys protegidas (Server-side side only).
    *   Prevenção de conteúdos duplicados e validação rigorosa de JSON.
*   **📅 Automação 24/7**: Workflow integrado via **GitHub Actions** para atualização semanal automática do blog.

---

## 🛠️ Stack Tecnológica

### Frontend
- **React 19**
- **Vite**
- **TailwindCSS 4**
- **Framer Motion** (Animações fluidas)
- **Lucide Icons**
- **React Markdown + Rehype Raw** (Renderização híbrida HTML/Markdown)

### Backend / Automação
- **Node.js + Express**
- **Groq SDK** (Llama 3.1 8B/70B)
- **RSS Parser**
- **Helmet.js** (Segurança)

---

## 🚀 Como Começar

### Pré-requisitos
- Node.js instalado (v18 ou superior)
- Uma conta na [Groq Cloud](https://console.groq.com/) para obter sua API Key.

### Instalação

1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/tech-insights-blog-de-tecnologia.git
   cd tech-insights-blog-de-tecnologia
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente:
   Crie um arquivo `.env` na raiz do projeto:
   ```env
   GROQ_API_KEY=sua_chave_aqui
   APP_URL=http://localhost:3000
   ```

4. Execute em modo de desenvolvimento:
   ```bash
   npm run dev
   ```
   Acesse: `http://localhost:3000`

---

## 🧠 Arquitetura de Conteúdo

Diferente de blogs tradicionais, o conteúdo aqui é gerado seguindo diretrizes de **Análise Estratégica**:

1.  **Coleta**: O sistema busca os 10 itens mais recentes de cada feed RSS configurado.
2.  **Variabilidade**: O contexto é embaralhado (`shuffle`) para garantir que cada geração traga uma nova perspectiva.
3.  **Processamento**: A Groq IA analisa o contexto e gera um JSON contendo o artigo em **HTML Semântico**.
4.  **Entrega**: O frontend renderiza o HTML garantindo acessibilidade e formatação técnica (tags `<pre><code>` para comandos).

---

## 🤝 Créditos e Contribuições

Este projeto foi desenvolvido com foco em automação total e design de alta qualidade.
- **Autor Original**: [Leonardo]
- **IA Pair Programming**: Desenvolvido e refinado em colaboração com o **Google Antigravity** (equipe da Google DeepMind utilizando Google Gemini).

---


