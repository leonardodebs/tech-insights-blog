import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import AdminPage from './pages/AdminPage.tsx';
import Privacidade from './pages/Privacidade.tsx';
import Termos from './pages/Termos.tsx';
import CookieConsent from './components/CookieConsent.tsx';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/termos" element={<Termos />} />
        </Routes>
        {/* Fora das rotas: o aviso precisa aparecer em qualquer página */}
        <CookieConsent />
      </HashRouter>
    </ThemeProvider>
  </StrictMode>,
);
