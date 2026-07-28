import { useState } from 'react';
import { KeyRound, Loader2, Check, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * Troca de senha dentro do painel, para o usuário já autenticado.
 *
 * Usa supabase.auth.updateUser({ password }), que atua sobre a sessão atual —
 * não depende do fluxo de e-mail de recuperação, que neste app não tem página
 * de destino (o link cai numa tela vazia com otp_expired). Assim a senha é
 * trocada sem sair do painel e sem e-mail.
 */
const MIN_LEN = 10;

export default function ChangePassword() {
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (pw1.length < MIN_LEN) {
      setMsg({ kind: 'err', text: `A senha precisa ter ao menos ${MIN_LEN} caracteres.` });
      return;
    }
    if (pw1 !== pw2) {
      setMsg({ kind: 'err', text: 'As senhas não coincidem.' });
      return;
    }

    setBusy(true);
    try {
      // O updateUser às vezes recebe o 200 do servidor (senha já trocada) mas a
      // promise interna não resolve, deixando o botão girando pra sempre. Um
      // timeout corta essa espera: se estourar, o request quase certamente foi
      // aceito, então orientamos a confirmar entrando com a senha nova.
      const TIMEOUT_MS = 12000;
      const result = await Promise.race([
        supabase.auth.updateUser({ password: pw1 }),
        new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), TIMEOUT_MS)),
      ]);

      if (result === 'timeout') {
        setPw1('');
        setPw2('');
        setMsg({
          kind: 'ok',
          text: 'A senha provavelmente foi alterada, mas a confirmação demorou. Clique em "Sair" e entre com a senha nova para conferir.',
        });
        return;
      }

      const { error } = result;
      if (error) {
        // Traduz os motivos mais comuns de 422 do Supabase para PT.
        const raw = error.message.toLowerCase();
        let amigavel: string;
        if (/different|same/.test(raw)) {
          amigavel = 'A nova senha precisa ser diferente da atual.';
        } else if (/weak|pwned|leaked|breach|compromis/.test(raw)) {
          amigavel = 'Essa senha é fraca ou já apareceu em vazamentos conhecidos. Escolha outra.';
        } else if (/length|characters|short/.test(raw)) {
          amigavel = 'A senha não atende ao tamanho mínimo exigido pelo projeto.';
        } else {
          amigavel = `Falha ao trocar a senha: ${error.message}`;
        }
        setMsg({ kind: 'err', text: amigavel });
        return;
      }
      setPw1('');
      setPw2('');
      setMsg({ kind: 'ok', text: 'Senha alterada com sucesso.' });
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      setMsg({
        kind: 'err',
        text: /fetch|network|blocked/i.test(m)
          ? 'A requisição foi bloqueada ou a rede caiu. Tente novamente.'
          : `Erro: ${m}`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
      <div className="flex gap-3 mb-4">
        <KeyRound className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-white text-sm">Alterar senha</h3>
          <p className="text-xs text-zinc-500 mt-1">Defina uma nova senha de acesso ao painel.</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3 max-w-md">
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            autoComplete="new-password"
            placeholder="Nova senha"
            aria-label="Nova senha"
            className="w-full pl-4 pr-12 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <input
          type={show ? 'text' : 'password'}
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          autoComplete="new-password"
          placeholder="Confirme a nova senha"
          aria-label="Confirme a nova senha"
          className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-emerald-500"
        />

        <button
          type="submit"
          disabled={busy || !pw1 || !pw2}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-950 font-bold text-sm rounded-lg transition-all flex items-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Salvar nova senha
        </button>

        {msg && (
          <p className={`text-xs ${msg.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
            {msg.text}
          </p>
        )}
      </form>
    </div>
  );
}
