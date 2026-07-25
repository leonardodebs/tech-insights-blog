import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Terminal, Cpu, Cloud, Github, Twitter, Mail, Sun, Moon, Menu, X, Lock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';

export default function Layout({ 
  children, 
  onSelectCategory, 
  selectedCategory,
  onReset,
}: { 
  children: React.ReactNode;
  onSelectCategory: (category: string | null) => void;
  selectedCategory: string | null;
  onReset: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const categories = ['Cloud', 'Observability', 'AI', 'Security', 'DevOps', 'Startups', 'Open Source'];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950 transition-colors duration-300">
      <header className="border-b border-zinc-200 dark:border-zinc-800/50 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button 
            onClick={onReset}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Terminal className="w-5 h-5 text-zinc-950" />
            </div>
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-white">TechPulse <span className="text-emerald-500">AI</span></span>
          </button>
          
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => onSelectCategory(cat)}
                className={`transition-colors ${
                  selectedCategory === cat ? 'text-emerald-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-emerald-500'
                }`}
              >
                {cat}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-emerald-500 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-emerald-500 transition-colors"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden"
            >
              <div className="px-6 py-4 flex flex-col gap-4">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      onSelectCategory(cat);
                      setIsMenuOpen(false);
                    }}
                    className={`text-left py-2 text-sm font-medium transition-colors ${
                      selectedCategory === cat ? 'text-emerald-500' : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-grow max-w-4xl mx-auto px-6 py-12 w-full">
        {children}
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800/50 py-12 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-500" />
              <span className="font-bold text-lg text-zinc-900 dark:text-white">TechPulse AI</span>
            </div>
            <p className="text-sm text-zinc-500 max-w-xs">Automação inteligente de notícias tech - Leonardo Debs</p>
            <div className="flex gap-5 mt-2">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                <Twitter className="w-5 h-5 text-zinc-500 hover:text-emerald-500 transition-colors" />
              </a>
              <a href="mailto:leonardodebs@gmail.com" aria-label="E-mail">
                <Mail className="w-5 h-5 text-zinc-500 hover:text-emerald-500 transition-colors" />
              </a>
              <a href="https://github.com/leonardodebs" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <Github className="w-5 h-5 text-zinc-500 hover:text-emerald-500 transition-colors" />
              </a>
            </div>
          </div>

          <nav aria-label="Legal" className="flex flex-col gap-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 dark:text-zinc-600">Legal</span>
            <Link to="/privacidade" className="text-sm text-zinc-500 hover:text-emerald-500 transition-colors">
              Privacidade
            </Link>
            <Link to="/termos" className="text-sm text-zinc-500 hover:text-emerald-500 transition-colors">
              Termos de uso
            </Link>
            <button
              onClick={() => window.dispatchEvent(new Event('open-cookie-preferences'))}
              className="text-sm text-zinc-500 hover:text-emerald-500 transition-colors text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 rounded"
            >
              Preferências de cookies
            </button>
          </nav>
        </div>
        <div className="max-w-4xl mx-auto px-6 mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-600">
          <span>© 2026 TechPulse AI. Feito com Claude &amp; React</span>
          <span className="flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            Análise só com consentimento
          </span>
        </div>
      </footer>
    </div>
  );
}
