import { useEffect, useState, useMemo, useCallback } from 'react';
import Layout from './components/Layout';
import PostCard from './components/PostCard';
import Toast, { ToastType } from './components/Toast';
import { Post } from './types';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { motion, AnimatePresence } from 'framer-motion'; // Changed from 'motion/react' to 'framer-motion'
import { ArrowLeft, Loader2, Sparkles, Search, Share2, Check, Twitter, Linkedin, Github, Zap, X, Info } from 'lucide-react';

// Modal que aparece em produção (GitHub Pages) explicando o fluxo de automação
function GitHubActionsModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 20 }}
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Automação via GitHub Actions</h2>
            <p className="text-xs text-zinc-500">Como os posts são gerados</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No GitHub Pages, a geração de posts é feita automaticamente pelo <strong>GitHub Actions</strong> toda segunda-feira às 9h.
            </p>
          </div>
          <div className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
            <Github className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Para gerar um post agora, dispare o workflow <strong>"AI Blog - Generate Weekly Post"</strong> manualmente pelo GitHub.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="https://github.com/leonardodebs/tech-insights-blog/actions/workflows/auto-blog.yml"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-xl transition-all text-sm"
          >
            <Github className="w-4 h-4" />
            Abrir GitHub Actions
          </a>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all text-sm"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

import postsData from './data/posts.json';

export default function App() {
  const [posts, setPosts] = useState<Post[]>(postsData);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [showGHModal, setShowGHModal] = useState(false);

  // import.meta.env.PROD é sempre true no build de produção (GitHub Pages)
  // e false no dev (localhost com Vite)
  const isProduction = import.meta.env.PROD;

  useEffect(() => {
    // Carregar do URL se houver ID de post
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('post');
    if (postId) {
      const post = postsData.find((p: Post) => p.id === postId);
      if (post) setSelectedPost(post);
    }
  }, []);

  const handleTriggerAutomation = async () => {
    // Em produção (GitHub Pages), não há backend — mostra o modal informativo
    if (isProduction) {
      setShowGHModal(true);
      return;
    }
    
    setIsGenerating(true);
    try {
      const response = await fetch('/api/trigger-automation', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategory })
      });
      const data = await response.json();
      if (data.success) {
        setToast({ message: 'Novo artigo gerado com sucesso!', type: 'success' });
      } else {
        setToast({ message: 'Erro ao gerar post: ' + data.error, type: 'error' });
      }
    } catch (error) {
      console.error('Error triggering automation:', error);
      setToast({ message: 'Erro de conexão ao gerar post.', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setToast({ message: 'Link copiado para a área de transferência!', type: 'success' });
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      setToast({ message: 'Erro ao copiar link.', type: 'error' });
    }
  };

  const shareOnTwitter = () => {
    if (!selectedPost) return;
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Confira este artigo: ${selectedPost.title}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  const shareOnLinkedIn = () => {
    if (!selectedPost) return;
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
  };

  const filteredPosts = useMemo(() => {
    let result = posts;
    
    if (selectedCategory) {
      result = result.filter(p => p.category.toLowerCase() === selectedCategory.toLowerCase());
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.title.toLowerCase().includes(query) || 
        p.excerpt.toLowerCase().includes(query) ||
        p.tags.some(t => t.toLowerCase().includes(query))
      );
    }
    
    return result;
  }, [posts, selectedCategory, searchQuery]);

  const closeToast = useCallback(() => setToast(null), []);

  return (
    <Layout 
      selectedCategory={selectedCategory} 
      onSelectCategory={(cat) => {
        setSelectedCategory(cat);
        setSelectedPost(null); // Back to list when changing category
      }}
    >
      <AnimatePresence mode="wait">
        {!selectedPost ? (
          <motion.div
            key={`list-${selectedCategory}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-12"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="flex-grow">
                <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
                  {selectedCategory ? (
                    <>Foco em <span className="text-emerald-500">{selectedCategory}</span></>
                  ) : (
                    <>Últimas do <span className="text-emerald-500">Mundo Tech</span></>
                  )}
                </h1>
                <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mb-6">
                  {selectedCategory 
                    ? `Explorando as novidades mais recentes especificamente sobre ${selectedCategory}.`
                    : 'Curadoria semanal automatizada sobre Cloud, Linux, IA, Segurança, DevOps e Startups.'
                  }
                </p>

                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Buscar artigos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
              
              <button
                onClick={handleTriggerAutomation}
                disabled={isGenerating}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 text-zinc-950 font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 whitespace-nowrap"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isGenerating ? 'Gerando Artigo...' : 'Gerar Novo Post'}
              </button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              </div>
            ) : filteredPosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredPosts.map((post) => (
                  <PostCard 
                    key={post.id} 
                    post={post} 
                    onClick={() => setSelectedPost(post)} 
                  />
                ))}
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-24 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/20"
              >
                <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Search className="w-8 h-8 text-zinc-400" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Nenhum artigo encontrado</h3>
                <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mb-8">
                  {searchQuery 
                    ? `Não encontramos resultados para "${searchQuery}". Tente outros termos.`
                    : 'Ainda não há artigos nesta categoria. Que tal gerar um agora?'}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button 
                    onClick={() => {
                      setSelectedCategory(null);
                      setSearchQuery('');
                    }}
                    className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-emerald-500 transition-colors"
                  >
                    Ver todos os posts
                  </button>
                  {!searchQuery && (
                    <button
                      onClick={handleTriggerAutomation}
                      disabled={isGenerating}
                      className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 text-zinc-950 font-bold rounded-xl hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      Gerar Primeiro Post
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-3xl mx-auto"
          >
            <div className="flex items-center justify-between mb-8">
              <button
                onClick={() => setSelectedPost(null)}
                className="flex items-center gap-2 text-zinc-500 hover:text-emerald-500 transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Voltar para a lista
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={shareOnTwitter}
                  title="Compartilhar no Twitter"
                  className="p-2 bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-sky-400 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all"
                >
                  <Twitter className="w-4 h-4" />
                </button>
                <button
                  onClick={shareOnLinkedIn}
                  title="Compartilhar no LinkedIn"
                  className="p-2 bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-blue-600 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all"
                >
                  <Linkedin className="w-4 h-4" />
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-emerald-500 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all text-sm font-medium"
                >
                  {isCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                  {isCopied ? 'Copiado!' : 'Compartilhar'}
                </button>
              </div>
            </div>

            <div className="mb-12">
              <div className="flex items-center gap-3 mb-4">
                <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
          selectedPost.category === 'AI' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' :
          selectedPost.category === 'Cloud' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
          selectedPost.category === 'Linux' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' :
          selectedPost.category === 'Security' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' :
          selectedPost.category === 'DevOps' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
          'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
        }`}>
                  {selectedPost.category}
                </span>
                <span className="text-zinc-300 dark:text-zinc-600">•</span>
                <span className="text-xs text-zinc-500">
                  {new Date(selectedPost.date).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-6 leading-tight">
                {selectedPost.title}
              </h1>
              <div className="flex gap-2">
                {selectedPost.tags.map(tag => (
                  <span key={tag} className="text-[10px] text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="markdown-body">
              <Markdown rehypePlugins={[rehypeRaw]}>{selectedPost.content}</Markdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={closeToast} 
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showGHModal && <GitHubActionsModal onClose={() => setShowGHModal(false)} />}
      </AnimatePresence>
    </Layout>
  );
}
