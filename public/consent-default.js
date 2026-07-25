/**
 * Declara o estado inicial de consentimento como negado, antes de qualquer
 * script de terceiro rodar. Não faz nenhuma requisição de rede.
 *
 * Extraído do <head> do index.html (era <script> inline) para permitir uma
 * Content-Security-Policy restritiva sem 'unsafe-inline' em script-src.
 * O GA4 só é efetivamente carregado após aceite explícito, em
 * src/components/CookieConsent.tsx.
 */
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
});
