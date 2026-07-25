import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    base: '/tech-insights-blog/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          /*
            Separa bibliotecas grandes e estáveis em chunks próprios (achado
            09.1). Ganho real: como o hash muda por conteúdo, um deploy que só
            altera nosso código não invalida o cache do react/supabase no
            navegador do visitante recorrente. react-markdown fica isolado
            porque só é usado na leitura de um post, não na listagem.
          */
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'supabase': ['@supabase/supabase-js'],
            'markdown': ['react-markdown', 'rehype-raw', 'rehype-sanitize'],
            'motion': ['motion'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
