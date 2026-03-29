import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, LogOut, Sparkles, Loader2, CheckCircle2, 
  AlertCircle, Clock, RefreshCw, TrendingUp, FileText, 
  Zap, Calendar, ArrowLeft, Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import postsData from '../data/posts.json';

interface AdminPanelProps {
  onLogout: () => void;
}

interface ActivityLog {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  time: Date;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export default function AdminPanel({ onLogout }: AdminPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState({
    totalPosts: postsData.length,
    lastPostDate: postsData[0]?.date ? new Date(postsData[0].date).toLocaleDateString('pt-BR') : 'Nenhum',
    categories: [...new Set(postsData.map((p: { category: string }) => p.category))].length,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    });
  }, []);

  const addLog = (message: string, type: 'success' | 'error' | 'info') => {
    setActivity(prev => [
      { id: Date.now().toString(), message, type, time: new Date() },
      ...prev.slice(0, 9), // keep last 10
    ]);
  };

  const handleGeneratePost = async () => {
    setIsGenerating(true);
    addLog('Iniciando geração de post via GitHub Actions...', 'info');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        addLog('Sessão expirada. Faça login novamente.', 'error');
        return;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/trigger-blog-post`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': SUPABASE_ANON,
          },
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        addLog('✅ Workflow iniciado! O post estará disponível em ~2 minutos.', 'success');
      } else {
        addLog(`Erro: ${data.error || 'Falha desconhecida'}`, 'error');
      }
    } catch (err) {
      addLog('Erro de conexão com o servidor.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Terminal className="w-5 h-5 text-zinc-950" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              TechPulse <span className="text-emerald-400">Admin</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={import.meta.env.BASE_URL || '/'}
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-emerald-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Ver Blog
            </a>
            <div className="w-px h-4 bg-zinc-700" />
            <span className="text-sm text-zinc-500">{userEmail}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-red-400 border border-zinc-700 hover:border-red-500/50 rounded-lg transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-3xl font-bold mb-2">
            Painel de Controle
          </h1>
          <p className="text-zinc-500">
            Gerencie os posts do TechPulse AI. Os posts são gerados automaticamente toda segunda-feira às 8h (Brasília).
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: FileText, label: 'Total de Posts', value: stats.totalPosts, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { icon: TrendingUp, label: 'Categorias', value: stats.categories, color: 'text-purple-400', bg: 'bg-purple-500/10' },
            { icon: Calendar, label: 'Último Post', value: stats.lastPostDate, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
            >
              <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-zinc-500 mt-0.5">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Generate Post Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="font-bold text-white">Gerar Novo Post</h2>
                <p className="text-xs text-zinc-500">Via GitHub Actions + Gemini AI</p>
              </div>
            </div>

            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              Aciona o workflow de geração de post com IA. O artigo é criado, comitado no repositório e o site é republicado automaticamente.
            </p>

            <button
              id="generate-post-btn"
              onClick={handleGeneratePost}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-950 font-bold rounded-xl transition-all active:scale-95 text-sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Iniciando workflow...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Gerar Post Agora
                </>
              )}
            </button>

            <div className="mt-4 p-3 bg-zinc-800/50 rounded-xl">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Clock className="w-3.5 h-3.5 text-emerald-500/70" />
                <span>Próxima geração automática: <strong className="text-zinc-400">Segunda-feira às 8h00 (BRT)</strong></span>
              </div>
            </div>
          </motion.div>

          {/* Activity Log */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <h2 className="font-bold text-white">Log de Atividade</h2>
                  <p className="text-xs text-zinc-500">Ações recentes desta sessão</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 min-h-[240px]">
              <AnimatePresence initial={false}>
                {activity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-zinc-600">
                    <Clock className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma ação realizada ainda.</p>
                  </div>
                ) : (
                  activity.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex items-start gap-2.5 p-3 rounded-xl text-sm ${
                        log.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                        log.type === 'error' ? 'bg-red-500/10 text-red-400' :
                        'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {log.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> :
                       log.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> :
                       <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                      <span className="flex-1">{log.message}</span>
                      <span className="text-xs opacity-50 flex-shrink-0">
                        {log.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* Manage Posts Section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
        >
          <div className="p-6 border-b border-zinc-800">
            <h2 className="font-bold text-white text-lg">Gerenciar Posts</h2>
            <p className="text-xs text-zinc-500">Exclua ou visualize os artigos publicados</p>
          </div>

          <div className="divide-y divide-zinc-800 max-h-[500px] overflow-y-auto custom-scrollbar">
            {postsData.map((post: any) => (
              <div key={post.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                <div className="flex flex-col gap-1 pr-4 min-w-0">
                  <h3 className="text-sm font-medium text-zinc-200 truncate">{post.title}</h3>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                    <span className="flex items-center gap-1 uppercase tracking-wider bg-zinc-800 px-1.5 py-0.5 rounded text-emerald-400">
                      {post.category}
                    </span>
                    <span>{new Date(post.date).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                
                <button
                  onClick={() => handleDeletePost(post.id, post.title)}
                  className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-90"
                  title="Excluir post"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}

// Add these to imports at the top
// import { Trash2 } from 'lucide-react';

async function handleDeletePost(id: string, title: string) {
  if (!confirm(`Tem certeza que deseja excluir o post: "${title}"?\nEssa ação é irreversível.`)) return;

  const btn = document.activeElement as HTMLButtonElement;
  if (btn) btn.disabled = true;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-posts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ action: 'delete', postId: id })
      }
    );

    const data = await response.json();
    if (response.ok && data.success) {
      alert('Solicitação de exclusão enviada! O post sumirá em breve (aguarde o build no GitHub).');
      window.location.reload(); // Refresh to update stats, though the file on disk won't change yet locally
    } else {
      alert(`Erro ao excluir: ${data.error || 'Falha desconhecida'}`);
    }
  } catch (err) {
    alert('Erro de conexão ao tentar excluir o post.');
  } finally {
    if (btn) btn.disabled = false;
  }
}
