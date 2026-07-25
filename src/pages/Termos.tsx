import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import Layout from '../components/Layout';

/**
 * Termos de Uso.
 *
 * Ponto material aqui: os artigos são gerados por IA a partir de feeds RSS.
 * Declarar isso de forma explícita, junto com a ausência de garantia de
 * exatidão, é o que protege o autor de uso indevido do conteúdo técnico.
 */
export default function Termos() {
  const navigate = useNavigate();
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
          <FileText className="w-6 h-6 text-emerald-500" />
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Termos de Uso</h1>
        </div>
        <p className="text-sm text-zinc-500 mb-10">Última atualização: 24 de julho de 2026</p>

        <div className="prose prose-zinc dark:prose-invert max-w-none prose-headings:font-bold prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-3 prose-p:text-zinc-700 dark:prose-p:text-zinc-300 prose-li:text-zinc-700 dark:prose-li:text-zinc-300">
          <h2>1. Sobre este site</h2>
          <p>
            O TechPulse AI é um blog pessoal de análises técnicas sobre Cloud, Observabilidade,
            Inteligência Artificial, Segurança, DevOps, Startups e Open Source, mantido por
            Leonardo Pereira Debs. O acesso é livre e gratuito.
          </p>

          <h2>2. Conteúdo gerado por inteligência artificial</h2>
          <p>
            Os artigos publicados aqui são <strong>produzidos automaticamente por um modelo de
            linguagem</strong> (Claude, da Anthropic), a partir da leitura de feeds RSS públicos de
            fontes técnicas. Não há revisão editorial humana de cada publicação antes de ir ao ar.
          </p>
          <p>Isso tem consequências que você precisa considerar:</p>
          <ul>
            <li>
              o texto pode conter <strong>imprecisões técnicas, interpretações equivocadas ou
              informações desatualizadas</strong>;
            </li>
            <li>
              as conclusões são análises geradas por modelo, não recomendações profissionais
              verificadas;
            </li>
            <li>
              a seção <em>Fontes</em> de cada artigo traz os links originais — em caso de dúvida,
              a fonte primária prevalece sobre o texto daqui.
            </li>
          </ul>

          <h2>3. Não constitui consultoria</h2>
          <p>
            O conteúdo tem finalidade <strong>informativa e educacional</strong>. Não constitui
            consultoria técnica, jurídica, financeira ou de segurança da informação. Decisões de
            arquitetura, investimento ou configuração de ambientes produtivos não devem se basear
            exclusivamente neste material. Avalie com profissionais qualificados e valide no seu
            próprio contexto.
          </p>

          <h2>4. Ausência de garantias</h2>
          <p>
            O site é oferecido “no estado em que se encontra”. Não há garantia de disponibilidade
            contínua, ausência de erros, ou de que o conteúdo esteja correto e atualizado. O autor
            não se responsabiliza por perdas ou danos decorrentes do uso das informações aqui
            publicadas.
          </p>

          <h2>5. Propriedade intelectual</h2>
          <p>
            Os textos originais deste blog podem ser citados livremente, desde que{' '}
            <strong>com atribuição e link para a página original</strong>. Títulos, trechos e dados
            de notícias pertencem às respectivas fontes citadas, e o uso aqui se dá a título de
            citação e análise crítica. Marcas de terceiros mencionadas pertencem a seus titulares.
          </p>

          <h2>6. Links externos</h2>
          <p>
            Há links para sites de terceiros. O autor não controla nem responde pelo conteúdo,
            pelas práticas de privacidade ou pela disponibilidade desses destinos.
          </p>

          <h2>7. Conduta esperada</h2>
          <p>
            Não é permitido tentar obter acesso não autorizado à área administrativa, à
            infraestrutura ou aos sistemas de apoio, nem realizar varreduras, testes de intrusão
            ou automações que degradem a disponibilidade do serviço.
          </p>
          <p>
            Encontrou uma falha de segurança? A divulgação responsável é bem-vinda: escreva para{' '}
            <a href="mailto:leonardodebs@gmail.com" className="text-emerald-600 dark:text-emerald-400">
              leonardodebs@gmail.com
            </a>{' '}
            antes de tornar pública.
          </p>

          <h2>8. Privacidade</h2>
          <p>
            O tratamento de dados está descrito na{' '}
            <Link to="/privacidade" className="text-emerald-600 dark:text-emerald-400">
              Política de Privacidade
            </Link>.
          </p>

          <h2>9. Alterações e foro</h2>
          <p>
            Estes termos podem ser atualizados a qualquer momento, com publicação nesta página.
            Aplica-se a legislação brasileira.
          </p>
        </div>
      </div>
    </Layout>
  );
}
