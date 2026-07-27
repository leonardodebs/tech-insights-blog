import { useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MfaEnrollProps {
  /** true quando já existe um fator TOTP verificado nesta conta. */
  enrolled: boolean;
  /** Recarrega o estado de MFA após cadastrar/remover. */
  onChange: () => void;
}

interface EnrollData {
  factorId: string;
  qrSvg: string;   // data URI SVG do QR code
  secret: string;  // fallback manual
}

/**
 * Seção de MFA dentro do painel admin.
 * Sem fator: botão "Ativar" → mostra QR → confirma com o primeiro código.
 * Com fator: mostra status ativo e permite remover.
 */
export default function MfaEnroll({ enrolled, onChange }: MfaEnrollProps) {
  const [enroll, setEnroll] = useState<EnrollData | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const startEnroll = async () => {
    setError('');
    setBusy(true);
    try {
      // Limpa fatores TOTP não verificados de tentativas anteriores. Um enroll
      // que trava/expira deixa um fator "pendente" na conta, e o Supabase
      // recusa um novo enroll enquanto ele existir ("factor already exists").
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const pendentes = (factors?.all ?? []).filter(
        (f) => f.factor_type === 'totp' && f.status !== 'verified'
      );
      for (const f of pendentes) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (err || !data) {
        // Mostra o motivo real do Supabase em vez de mensagem genérica.
        setError(err?.message ? `Falha ao iniciar: ${err.message}` : 'Não foi possível iniciar o cadastro do fator.');
        return;
      }
      setEnroll({ factorId: data.id, qrSvg: data.totp.qr_code, secret: data.totp.secret });
    } catch (e) {
      setError(e instanceof Error ? `Erro: ${e.message}` : 'Erro inesperado ao cadastrar o fator.');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enroll) return;
    setError('');
    setBusy(true);
    try {
      const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId: enroll.factorId });
      if (cErr || !ch) {
        // Mostra o erro real do Supabase (status + código + mensagem) em vez de
        // texto genérico, para diagnosticar sem depender do DevTools.
        const detail = cErr ? `${cErr.status ?? ''} ${cErr.code ?? ''} ${cErr.message}`.trim() : 'sem resposta';
        setError(`Falha no challenge: ${detail}`);
        return;
      }
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: ch.id,
        code: code.trim(),
      });
      if (vErr) {
        const detail = `${vErr.status ?? ''} ${vErr.code ?? ''} ${vErr.message}`.trim();
        setError(`Falha no verify: ${detail}`);
        return;
      }
      setEnroll(null);
      setCode('');
      onChange();
    } catch (e) {
      // Sem este catch, uma requisição bloqueada por extensão do navegador
      // (ERR_BLOCKED_BY_CLIENT) ou queda de rede fazia o botão parar de girar
      // sem explicar nada — falha silenciosa. Agora o motivo aparece.
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        /fetch|network|load failed|blocked/i.test(msg)
          ? 'A requisição foi bloqueada (extensão do navegador/antivírus?) ou a rede caiu. Tente numa janela anônima ou libere o site no bloqueador.'
          : `Erro ao verificar: ${msg}`
      );
    } finally {
      setBusy(false);
    }
  };

  const cancelEnroll = async () => {
    // Remove o fator não verificado que foi criado no enroll.
    if (enroll) await supabase.auth.mfa.unenroll({ factorId: enroll.factorId });
    setEnroll(null);
    setCode('');
    setError('');
  };

  const removeFactor = async () => {
    if (!confirm('Remover a verificação em duas etapas desta conta?')) return;
    setBusy(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.find(f => f.status === 'verified');
      if (totp) await supabase.auth.mfa.unenroll({ factorId: totp.id });
      onChange();
    } finally {
      setBusy(false);
    }
  };

  // Estado 1: já cadastrado
  if (enrolled && !enroll) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-white text-sm">Verificação em duas etapas ativa</h3>
              <p className="text-xs text-zinc-500 mt-1">Todo login no painel exige o código do app autenticador.</p>
            </div>
          </div>
          <button
            onClick={removeFactor}
            disabled={busy}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors shrink-0"
          >
            Remover
          </button>
        </div>
      </div>
    );
  }

  // Estado 2: cadastrando (QR visível)
  if (enroll) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h3 className="font-bold text-white text-sm mb-3">Ativar verificação em duas etapas</h3>
        <ol className="text-xs text-zinc-400 space-y-1 mb-4 list-decimal list-inside">
          <li>Abra seu app autenticador (Google Authenticator, Aegis, 2FAS...)</li>
          <li>Escaneie o QR Code abaixo</li>
          <li>Digite o código de 6 dígitos que aparecer</li>
        </ol>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          {/* qr_code do Supabase é um data URI SVG */}
          <img src={enroll.qrSvg} alt="QR Code para o app autenticador" className="w-40 h-40 bg-white rounded-lg p-2 shrink-0" />
          <div className="flex-1 w-full">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Ou digite manualmente</p>
            <code className="block text-xs text-emerald-400 bg-zinc-800 rounded-lg p-2 break-all mb-3">{enroll.secret}</code>

            <form onSubmit={confirmEnroll} className="space-y-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
                placeholder="000000"
                aria-label="Código de confirmação"
                className="w-full text-center text-lg tracking-[0.4em] font-mono py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy || code.length !== 6}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-950 font-bold text-sm rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirmar
                </button>
                <button
                  type="button"
                  onClick={cancelEnroll}
                  className="px-4 py-2.5 text-zinc-400 hover:text-white text-sm rounded-lg border border-zinc-700 transition-colors flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" /> Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
      </div>
    );
  }

  // Estado 3: não cadastrado, sem enroll em curso
  return (
    <div className="bg-zinc-900 border border-amber-500/20 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-white text-sm">Verificação em duas etapas desativada</h3>
            <p className="text-xs text-zinc-500 mt-1">Proteja o painel com um segundo fator além da senha.</p>
          </div>
        </div>
        <button
          onClick={startEnroll}
          disabled={busy}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 text-zinc-950 font-bold text-sm rounded-lg transition-all flex items-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Ativar
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
    </div>
  );
}
