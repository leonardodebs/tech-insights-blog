import { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Loader2, AlertCircle, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getVerifiedTotpFactorId } from '../lib/useMfa';

interface MfaChallengeProps {
  /** Chamado após verificar o código com sucesso (sessão vira aal2). */
  onVerified: () => void;
  /** Sair sem completar o segundo fator. */
  onCancel: () => void;
}

/**
 * Desafio TOTP exibido quando a sessão está em aal1 mas há fator cadastrado.
 * Sem passar por aqui, o painel não é liberado.
 */
export default function MfaChallenge({ onVerified, onCancel }: MfaChallengeProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const factorId = await getVerifiedTotpFactorId();
      if (!factorId) {
        setError('Nenhum fator de autenticação encontrado.');
        return;
      }
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr || !challenge) {
        setError('Não foi possível iniciar a verificação.');
        return;
      }
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (vErr) {
        setError('Código incorreto ou expirado.');
        return;
      }
      onVerified();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03] admin-grid-pattern" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md relative"
      >
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl shadow-black/60">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-4">
              <ShieldCheck className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Verificação em duas etapas</h1>
            <p className="text-sm text-zinc-500 mt-1 text-center">
              Digite o código de 6 dígitos do seu app autenticador
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
              placeholder="000000"
              aria-label="Código de verificação"
              className="w-full text-center text-2xl tracking-[0.5em] font-mono py-4 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
            />

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading || code.length !== 6}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-950 font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</> : 'Verificar'}
            </button>
          </form>

          <button
            onClick={onCancel}
            className="w-full mt-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 rounded"
          >
            <LogOut className="w-3.5 h-3.5" /> Cancelar e sair
          </button>
        </div>
      </motion.div>
    </div>
  );
}
