import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import CookieConsent from './components/CookieConsent.tsx';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext';

/**
 * Rotas fora do caminho crítico carregadas sob demanda (achado 09.1 da
 * auditoria): o painel admin sozinho — Supabase Auth, formulários, chamadas
 * às Edge Functions — ia para TODO visitante do blog, mesmo quem nunca
 * acessa /admin. Privacidade/Termos são visitados raramente, mesmo
 * princípio. App (lista + leitura de post) é o caminho que todo mundo usa,
 * então continua no bundle principal.
 */
const AdminPage = lazy(() => import('./pages/AdminPage.tsx'));
const Privacidade = lazy(() => import('./pages/Privacidade.tsx'));
const Termos = lazy(() => import('./pages/Termos.tsx'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <HashRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/privacidade" element={<Privacidade />} />
            <Route path="/termos" element={<Termos />} />
          </Routes>
        </Suspense>
        {/* Fora das rotas: o aviso precisa aparecer em qualquer página */}
        <CookieConsent />
      </HashRouter>
    </ThemeProvider>
  </StrictMode>,
);
