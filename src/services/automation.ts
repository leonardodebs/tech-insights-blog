import Groq from "groq-sdk";
import Parser from "rss-parser";
import fs from "fs";
import path from "path";
import { Post } from "../types";

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  }
});

const POSTS_PATH = path.resolve(process.cwd(), "src/data/posts.json");

const FEEDS = [
  // Cloud
  "https://aws.amazon.com/blogs/aws/feed/",
  "https://azure.microsoft.com/en-us/blog/feed/",
  "https://cloud.google.com/blog/rss.xml",
  // Linux / Open Source
  "https://www.phoronix.com/rss.php",
  "https://arstechnica.com/information-technology/feed/",
  "https://www.zdnet.com/topic/linux/rss.xml",
  // AI
  "https://openai.com/news/rss.xml",
  "https://venturebeat.com/category/ai/feed/",
  "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
  // Security
  "https://www.bleepingcomputer.com/feed/",
  "https://www.darkreading.com/rss.xml",
  "https://krebsonsecurity.com/feed/",
  // DevOps
  "https://kubernetes.io/feed.xml",
  "https://devops.com/feed/",
  "https://www.infoq.com/feed/cloud-computing/",
  // Startups
  "https://techcrunch.com/category/startups/feed/",
  "https://www.wired.com/category/business/feed/",
  // Brasil / Tech General
  "https://tecnoblog.net/feed/"
];

export async function runAutomation(targetCategory?: string | null) {
  console.log(`Starting intelligence gathering process with Groq${targetCategory ? ` for category: ${targetCategory}` : ''}...`);

  let apiKey = process.env.GROQ_API_KEY;
  
  if (apiKey) {
    apiKey = apiKey.trim().replace(/^["']|["']$/g, "");
  }

  if (!apiKey || apiKey === "MY_GROQ_API_KEY" || apiKey === "") {
    console.error("No valid API key found in GROQ_API_KEY.");
    throw new Error("Configuração incompleta: Por favor, adicione sua chave GROQ_API_KEY no painel de Secrets.");
  }

  console.log(`Using Groq API Key starting with: ${apiKey.substring(0, 6)}...`);

  // 1. Fetch RSS Feeds
  const newsItems: string[] = [];
  for (const url of FEEDS) {
    try {
      console.log(`Gathering intelligence from: ${url}`);
      // Simple timeout wrapper for parseURL
      const feedPromise = parser.parseURL(url);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout gathering from feed")), 8000)
      );
      
      const feed = await Promise.race([feedPromise, timeoutPromise]) as any;
      
      // Get more items to allow for randomization
      feed.items.slice(0, 10).forEach(item => {
        newsItems.push(`- [${feed.title}] ${item.title}: ${item.contentSnippet || item.summary || ""}`);
      });
    } catch (error) {
      console.warn(`Warning: Could not access ${url}.`);
    }
  }

  if (newsItems.length === 0) {
    throw new Error("No intelligence could be gathered from RSS feeds.");
  }

  // Shuffle and pick a random subset to ensure variability
  const shuffledContext = newsItems
    .sort(() => Math.random() - 0.5)
    .slice(0, 8)
    .join("\n");

  // 2. Call Groq to generate article
  const groq = new Groq({ apiKey });
  const model = "llama-3.1-8b-instant";

  const prompt = `
    Como um Analista Sênior de Tecnologia e Estrategista, crie um relatório de inteligência e novidades em Português do Brasil.
    CATEGORIA ALVO: ${targetCategory || 'Trend Report (Cloud, IA, Security, DevOps, Linux ou Startups)'}
    
    CONTEXTO DAS ÚLTIMAS 24H (Aleatório para variabilidade):
    ${shuffledContext.substring(0, 3000)}

    DIRETRIZES TÉCNICAS E DE FORMATO (OBRIGATÓRIO):
    1. O campo 'content' DEVE conter EXCLUSIVAMENTE código HTML válido. NÃO use blocos de marcação markdown como \`\`\`html.
    2. ZERO METADADOS: Nunca escreva palavras como "Título:", "Resumo:", "Introdução:" ou "Seção 1:". O texto deve fluir naturalmente de forma narrativa.
    3. SUBTÍTULOS: Use <h2> e <h3> com frases descritivas e fluidas (ex: "Desvendando a nova arquitetura do kernel" em vez de "Seção 2: Linux").
    4. PROFUNDIDADE TÉCNICA: Sempre inclua exemplos práticos de terminal, scripts de automação ou arquivos de configuração reais.
    5. TAGS DE CÓDIGO: Envolva todos os comandos e scripts em <pre><code>. Use <strong> para destacar nomes de diretórios, daemons, variáveis e caminhos de arquivos.
    6. LINGUAGEM: Escreva em Português do Brasil com tom analítico e profissional.
    7. SEGURANÇA JSON: Use apenas aspas simples (') dentro do conteúdo HTML para evitar erros de escape.

    ESTRUTURA SUGERIDA PARA O CONTEÚDO (HTML):
    - Uma <h2> inicial impactante com a análise da notícia principal.
    - Parágrafos fluidos conectando os fatos do contexto fornecido.
    - Uma <h3> dedicada à implementação técnica com blocos <pre><code>.
    - Conclusão focada no impacto de mercado a longo prazo.
    - Uma lista <ul> ao final com 5 termos técnicos (SEO Tags).

    JSON SCHEMA:
    {
      "title": "Manchete curta para o card (sem HTML)",
      "excerpt": "Resumo analítico de 2 linhas (sem HTML)",
      "category": "...",
      "tags": ["tag1", "tag2"],
      "content": "CONTEÚDO HTML PURO AQUI"
    }
  `;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Você é um Arquiteto Cloud e Sysadmin Sênior. Escreva um artigo técnico em português resumindo as notícias fornecidas.\n\nREGRAS CRÍTICAS DE SAÍDA:\n1. Retorne EXCLUSIVAMENTE código HTML válido. NUNCA retorne blocos de código Markdown (```html).\n2. Comece a resposta DIRETAMENTE com uma tag <p> introdutória ou um <h2>.\n3 Use <pre><code> para QUALQUER bloco de código, comando de terminal ou script.\n4. Use <strong> para destacar ferramentas, daemons, caminhos (ex: /etc/nginx) e variáveis.\n\nEXEMPLO EXATO DO FORMATO DE SAÍDA ESPERADO:\n<p>A segurança de aplicações e o gerenciamento de processos continuam sendo o núcleo da infraestrutura moderna. Com as atualizações recentes, novas abordagens estão sendo adotadas em ambientes de produção.</p>\n\n<h2>Implementação e Controle de Acesso</h2>\n<p>Para garantir que serviços essenciais rodem com os privilégios corretos e com validação de tokens segura, a configuração deve ser explícita. Veja o padrão de validação JWT:</p>\n\n<pre><code>\nconst express = require('express');\nconst jwt = require('jsonwebtoken');\n\napp.get('/protected', (req, res) => {\n  const token = req.headers.authorization;\n  // lógica de verificação\n});\n</code></pre>\n\n<h3>Protegendo a Infraestrutura</h3>\n<p>Lembre-se de auditar constantemente os diretórios críticos como <strong>/var/log/auth.log</strong> e manter suas bibliotecas atualizadas.</p>"
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: model,
      response_format: { type: "json_object" },
      max_tokens: 4096,
      temperature: 0.5,
    });

    const responseText = chatCompletion.choices[0]?.message?.content || "{}";
    
    // Clean response text in case the model wrapped it in markdown code blocks
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith("```json")) {
      cleanedResponse = cleanedResponse.replace(/^```json/, "").replace(/```$/, "");
    } else if (cleanedResponse.startsWith("```")) {
      cleanedResponse = cleanedResponse.replace(/^```/, "").replace(/```$/, "");
    }
    
    let result;
    try {
      result = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("Initial JSON parse failed, attempting to fix common issues:", parseError);
      try {
        const lastBraceIndex = cleanedResponse.lastIndexOf("}");
        if (lastBraceIndex !== -1) {
          cleanedResponse = cleanedResponse.substring(0, lastBraceIndex + 1);
        }
        result = JSON.parse(cleanedResponse);
      } catch (secondParseError) {
        console.error("Failed to fix JSON JSON:", secondParseError);
        throw new Error("O modelo gerou um formato de dados inválido e não pôde ser recuperado.");
      }
    }
    
    // Safety check: ensure content is not empty
    if (!result.content || result.content.length < 50) {
      console.error("Article content is too short or missing in LLM response.");
      // Fallback if the model put the content in a different field or just failed
      if (result.analysis || result.report) {
        result.content = result.analysis || result.report;
      } else {
        throw new Error("A IA gerou um artigo incompleto (sem conteúdo). Por favor, tente novamente.");
      }
    }
    
    // 3. Save to posts.json
    let existingPosts: Post[] = [];
    try {
      if (fs.existsSync(POSTS_PATH)) {
        const fileContent = fs.readFileSync(POSTS_PATH, "utf-8");
        existingPosts = JSON.parse(fileContent || "[]");
      }
    } catch (e) {
      console.error("Error reading posts.json, starting with empty list:", e);
      existingPosts = [];
    }
    
    const newPost: Post = {
      id: `post-${Date.now()}`,
      title: result.title || "Sem título",
      date: new Date().toISOString(),
      excerpt: result.excerpt || "Resumo não disponível",
      content: result.content,
      tags: result.tags || [],
      category: targetCategory || result.category || "General"
    };

    // Prevent identical duplicate posts by title
    const isDuplicate = existingPosts.some(p => p.title.toLowerCase() === newPost.title.toLowerCase());
    if (isDuplicate) {
      console.warn(`Duplicate post title detected: ${newPost.title}`);
      throw new Error("Um artigo com este título já foi publicado recentemente. Tente novamente para gerar uma nova perspectiva.");
    }

    existingPosts.unshift(newPost);
    fs.writeFileSync(POSTS_PATH, JSON.stringify(existingPosts, null, 2));

    console.log("New intelligence report generated and saved successfully!");
    return newPost;
  } catch (error) {
    console.error("Error in automation flow:", error);
    throw error;
  }
}
