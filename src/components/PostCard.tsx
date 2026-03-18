import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Post } from '../types';
import { motion } from 'motion/react';
import { ArrowRight, Tag, Calendar } from 'lucide-react';

interface PostCardProps {
  post: Post;
  onClick: () => void;
}

export default function PostCard({ post, onClick }: PostCardProps) {
  return (
    <motion.article 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="group cursor-pointer p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-emerald-500/50 transition-all duration-300 shadow-sm hover:shadow-md"
      onClick={onClick}
    >
      <div className="flex items-center gap-3 mb-4">
        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
          post.category === 'AI' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' :
          post.category === 'Cloud' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
          post.category === 'Linux' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' :
          post.category === 'Security' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' :
          post.category === 'DevOps' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
          'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
        }`}>
          {post.category}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Calendar className="w-3.5 h-3.5" />
          {format(new Date(post.date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
        </div>
      </div>

      <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-3 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">
        {post.title}
      </h2>
      
      <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed mb-6 line-clamp-2">
        {post.excerpt}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {post.tags.slice(0, 2).map(tag => (
            <span key={tag} className="flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
              <Tag className="w-2.5 h-2.5" />
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1 text-emerald-500 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Ler mais <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </motion.article>
  );
}
