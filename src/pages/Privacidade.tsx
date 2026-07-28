import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import Layout from '../components/Layout';

/**
 * Política de Privacidade.
 *
 * O conteúdo descreve exatamente o que a auditoria técnica constatou que o site
 * faz: GA4 como único tratamento, cookies apenas após consentimento, nenhum
 * formulário e nenhum dado pessoal coletado diretamente. Declarar mais do que
 * se pratica cria exposição legal em vez de reduzi-la.
 */
export default function Privacidade() {
  const navigate = useNavigate();
  // A navegação por categoria vive no App; daqui, volta para a home.
  const goHome = () => navigate('/');

  return (
    <Layout onSelectCategory={goHome} selectedCategory={null} onReset={goHome}>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-emerald-500 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao blog
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-6 h-6 text-emerald-500" />
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Política de Privacidade</h1>
        </div>
        <p className="text-sm text-zinc-500 mb-10">Última atualização: 28 de julho de 2026</p>

        <div className="prose prose-zinc dark:prose-invert max-w-none prose-headings:font-bold prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-3 prose-p:text-zinc-700 dark:prose-p:text-zinc-300 prose-li:text-zinc-700 dark:prose-li:text-zinc-300">
          <h2>1. Quem é o controlador</h2>
          <p>
            Este blog é um projeto pessoal mantido por <strong>Leonardo Pereira Debs</strong>.
            Para qualquer assunto relativo a dados pessoais, o contato é{' '}
            <a href="mailto:leonardodebs@gmail.com" className="text-emerald-600 dark:text-emerald-400">
              leonardodebs@gmail.com
            </a>.
          </p>

          <h2>2. Quais dados são tratados</h2>
          <p>
            O site <strong>não possui formulários, cadastro de leitores, newsletter ou comentários</strong>.
            Nenhum dado pessoal é solicitado a você para ler o conteúdo.
          </p>
          <p>O único tratamento existente é de métricas de audiência, e apenas se você consentir:</p>
          <ul>
            <li>
              <strong>Google Analytics 4</strong> — páginas visitadas, tempo de permanência, origem
              do acesso, tipo de dispositivo, navegador e localização aproximada (nível de cidade,
              derivada do IP). O endereço IP é anonimizado pela própria plataforma.
            </li>
          </ul>
          <p>
            Se você recusar os cookies, <strong>o script de análise não é carregado</strong> e nenhuma
            métrica sua é coletada.
          </p>

          <h2>3. Base legal e finalidade</h2>
          <p>
            O tratamento de métricas ocorre sob a base legal do <strong>consentimento</strong>
            (art. 7º, I da LGPD), coletado por meio do aviso de cookies exibido no primeiro acesso.
            A finalidade é exclusivamente entender quais assuntos têm audiência e orientar a
            produção de conteúdo. <strong>Não há</strong> perfilamento para publicidade, venda de
            dados, nem decisão automatizada sobre você.
          </p>

          <h2>4. Cookies</h2>
          <p>Somente após consentimento:</p>
          <ul>
            <li>
              <code>_ga</code>, <code>_ga_*</code> — Google Analytics, distinguem visitantes de
              forma pseudonimizada. Validade de até 2 anos.
            </li>
          </ul>
          <p>
            Independentemente de consentimento, é gravada uma preferência local (
            <code>localStorage</code>) registrando sua escolha sobre cookies e o tema
            claro/escuro. São dados que <strong>não saem do seu navegador</strong> e não são
            transmitidos a ninguém.
          </p>
          <p>
            Você pode alterar sua decisão a qualquer momento pelo botão{' '}
            <strong>“Preferências de cookies”</strong> no rodapé.
          </p>

          <h2>5. Compartilhamento e operadores</h2>
          <p>Ao acessar o site, alguns terceiros necessariamente recebem seu endereço IP:</p>
          <ul>
            <li><strong>GitHub Pages</strong> (Microsoft) — hospedagem e entrega das páginas;</li>
            <li><strong>Fastly</strong> — rede de distribuição de conteúdo;</li>
            <li><strong>Google Fonts</strong> — fornecimento das fontes tipográficas;</li>
            <li><strong>Google Analytics</strong> — métricas, apenas com consentimento;</li>
            <li><strong>Supabase</strong> — banco de dados que armazena os artigos.</li>
          </ul>
          <p>
            Esses provedores operam servidores fora do Brasil, o que implica{' '}
            <strong>transferência internacional de dados</strong> (art. 33 da LGPD), amparada nas
            cláusulas contratuais e políticas de privacidade de cada operador.
          </p>

          <h2>6. Por quanto tempo</h2>
          <p>
            As métricas do Google Analytics são retidas pelos seguintes prazos, após os quais os
            dados são descartados automaticamente pela plataforma:
          </p>
          <ul>
            <li><strong>Dados de evento</strong> (registro granular de cada interação): 2 meses;</li>
            <li><strong>Dados de usuário</strong> (identificador pseudonimizado do visitante): 14 meses.</li>
          </ul>
          <p>
            Adotamos o menor prazo disponível para os dados de evento, em linha com o princípio da
            minimização. Não há base de dados pessoais mantida por este site.
          </p>

          <h2>7. Seus direitos</h2>
          <p>A LGPD (art. 18) garante a você:</p>
          <ul>
            <li>confirmação da existência de tratamento e acesso aos dados;</li>
            <li>correção de dados incompletos ou desatualizados;</li>
            <li>anonimização, bloqueio ou eliminação de dados desnecessários;</li>
            <li>portabilidade;</li>
            <li>informação sobre com quem os dados foram compartilhados;</li>
            <li>revogação do consentimento a qualquer momento.</li>
          </ul>
          <p>
            Para exercer qualquer um deles, escreva para{' '}
            <a href="mailto:leonardodebs@gmail.com" className="text-emerald-600 dark:text-emerald-400">
              leonardodebs@gmail.com
            </a>. O prazo de resposta é de até 15 dias.
          </p>
          <p>
            Observação prática: como o site não mantém cadastro, na maioria dos casos não há dado
            pessoal seu identificável para localizar. Se quiser apenas interromper a coleta de
            métricas, a via mais direta é recusar os cookies no rodapé.
          </p>

          <h2>8. Segurança</h2>
          <p>
            O site é servido exclusivamente por HTTPS com TLS 1.2 e 1.3. Não há área pública de
            envio de dados. O painel administrativo, de uso restrito ao autor, é protegido por
            autenticação e não trata dados de leitores.
          </p>

          <h2>9. Alterações</h2>
          <p>
            Mudanças nesta política serão publicadas nesta página, com atualização da data no
            topo. Alterações que ampliem o tratamento de dados exigirão novo consentimento.
          </p>
        </div>
      </div>
    </Layout>
  );
}
