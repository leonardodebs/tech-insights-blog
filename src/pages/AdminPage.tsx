import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AdminLogin from './AdminLogin';
import AdminPanel from './AdminPanel';
import MfaChallenge from './MfaChallenge';
import { useMfaStatus } from '../lib/useMfa';
import { Loader2, Terminal } from 'lucide-react';

function Splash() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
        <Terminal className="w-6 h-6 text-emerald-400" />
      </div>
      <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
    </div>
  );
}

export default function AdminPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { status: mfa, refresh: refreshMfa } = useMfaStatus();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    // Local scope: encerra a sessão sem depender de request ao servidor, que
    // pode travar/ser bloqueado. try/catch garante que a UI volta ao login.
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      /* limpa a UI de qualquer forma */
    }
    setSession(null);
  };

  if (loading) return <Splash />;

  // Sem sessão → login por senha.
  if (!session) {
    return <AdminLogin onLogin={() => refreshMfa()} />;
  }

  // Há sessão, mas o nível de garantia ainda está sendo lido.
  if (mfa.state === 'loading') return <Splash />;

  // Fator cadastrado e a sessão só passou por senha (aal1): exige o segundo
  // fator ANTES de liberar o painel. É o que impede o bypass do MFA.
  if (mfa.state === 'needs-challenge') {
    return <MfaChallenge onVerified={() => refreshMfa()} onCancel={handleLogout} />;
  }

  // aal2 verificado, ou nenhum fator cadastrado (aal1/aal1). No segundo caso,
  // o painel mostra o aviso para ativar o MFA.
  return (
    <AdminPanel
      onLogout={() => setSession(null)}
      mfaEnrolled={mfa.state === 'verified'}
      onMfaChange={refreshMfa}
    />
  );
}
