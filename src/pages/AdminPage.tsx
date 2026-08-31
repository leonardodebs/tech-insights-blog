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
  // null = ainda verificando
  const [ehAdmin, setEhAdmin] = useState<boolean | null>(null);
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

  // Papel do usuário (achado A-05). Antes bastava existir sessão para o painel
  // renderizar, então qualquer conta autenticada via a interface administrativa
  // completa. As ações já eram barradas no servidor com 403, mas a interface
  // prometia um privilégio inexistente.
  //
  // Usa getUser(), que consulta o servidor de auth em vez de ler o JWT em cache:
  // assim uma mudança de papel vale na hora, sem exigir novo login.
  useEffect(() => {
    if (!session) {
      setEhAdmin(null);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      const papel = (data?.user?.app_metadata as Record<string, unknown> | null)?.role;
      setEhAdmin(papel === 'admin');
    });
  }, [session]);

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

  // Papel ainda sendo consultado no servidor.
  if (ehAdmin === null) return <Splash />;

  // Autenticado, porém sem privilégio. O servidor continua sendo a autoridade
  // (as Edge Functions recusam com 403); esta tela apenas evita exibir uma
  // interface administrativa a quem não pode usá-la.
  if (!ehAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center">
          <Terminal className="w-6 h-6 text-red-400" />
        </div>
        <h1 className="text-lg font-bold text-white">Acesso restrito</h1>
        <p className="text-sm text-zinc-500 max-w-sm">
          Esta conta está autenticada, mas não tem permissão de administrador.
        </p>
        <button
          onClick={handleLogout}
          className="mt-2 px-4 py-2 text-sm text-zinc-400 hover:text-white border border-zinc-700 rounded-lg transition-colors"
        >
          Sair
        </button>
      </div>
    );
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
