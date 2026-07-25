import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';

/**
 * Aviso de cookies com carregamento condicional do Google Analytics.
 *
 * Decisão de implementação: o script do GA4 só é injetado APÓS o aceite. A
 * abordagem mais comum (Consent Mode com analytics_storage negado) ainda carrega
 * o gtag.js, o que entrega o IP do visitante ao Google antes de qualquer
 * manifestação dele. Para a LGPD, não fazer a requisição é posição mais
 * defensável do que fazê-la e não gravar cookie.
 *
 * O ID de medição vem de VITE_GA_MEASUREMENT_ID, com fallback para o ID atual
 * do projeto — assim o comportamento não muda para quem fizer build sem a env.
 */
const GA_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) ?? 'G-P1VHS3GBKC';
const STORAGE_KEY = 'cookie-consent';

type Consent = 'granted' | 'denied';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function loadAnalytics() {
  // Evita injeção duplicada em re-render ou ao aceitar duas vezes.
  if (document.getElementById('ga-script')) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer!.push(arguments);
  };

  const script = document.createElement('script');
  script.id = 'ga-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.gtag('js', new Date());
  window.gtag('consent', 'update', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('config', GA_ID, { anonymize_ip: true });
}

/** Remove os cookies do GA4 ao revogar o consentimento. */
function clearAnalyticsCookies() {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (name.startsWith('_ga')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${location.hostname}`;
    }
  });
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Consent | null;
    if (saved === 'granted') {
      loadAnalytics();
    } else if (saved !== 'denied') {
      setVisible(true); // nunca decidiu: pergunta
    }

    // Permite reabrir o aviso pelo rodapé.
    const reopen = () => setVisible(true);
    window.addEventListener('open-cookie-preferences', reopen);
    return () => window.removeEventListener('open-cookie-preferences', reopen);
  }, []);

  const decide = (consent: Consent) => {
    localStorage.setItem(STORAGE_KEY, consent);
    setVisible(false);
    if (consent === 'granted') {
      loadAnalytics();
    } else {
      clearAnalyticsCookies();
    }
  };

  return (
    <>
      {/*
        Elemento sempre montado, com transição CSS e o estado governando
        visibility/pointer-events juntos.

        Histórico: com {visible && <motion.div>} dentro de AnimatePresence, o nó
        não era re-renderizado durante a saída, permanecia no DOM com opacity 0 e
        pointer-events ativos — um retângulo invisível de ~166px fixo no rodapé
        engolindo os cliques dos links legais (verificado com elementFromPoint).
        Tentativas de corrigir via props do motion falharam porque visibility é
        propriedade discreta e o motion não a aplicava de forma confiável.
        Transição CSS é determinística e suficiente para um fade com deslocamento.
      */}
      <div
        role="dialog"
        aria-live="polite"
        aria-label="Aviso de cookies"
        aria-hidden={!visible}
        className={`fixed bottom-0 left-0 right-0 z-[100] p-4 sm:p-6 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
          visible
            ? 'opacity-100 translate-y-0 visible pointer-events-auto'
            : 'opacity-0 translate-y-6 invisible pointer-events-none'
        }`}
      >
        <div className="max-w-4xl mx-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex gap-3 flex-1">
              <Cookie className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                Uso cookies do Google Analytics apenas para saber quais assuntos têm audiência.
                Se você recusar, o script nem é carregado e nada seu é coletado. Detalhes na{' '}
                <Link
                  to="/privacidade"
                  className="text-emerald-600 dark:text-emerald-400 underline underline-offset-2"
                >
                  Política de Privacidade
                </Link>.
              </p>
            </div>
            {/* Recusar tem o mesmo destaque de aceitar: exigência da LGPD */}
            <div className="flex gap-3 shrink-0">
              <button
                onClick={() => decide('denied')}
                className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
              >
                Recusar
              </button>
              <button
                onClick={() => decide('granted')}
                className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
              >
                Aceitar
              </button>
            </div>
          </div>
      </div>
    </>
  );
}
