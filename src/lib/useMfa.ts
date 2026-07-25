import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Estado de MFA (TOTP) da sessão atual, via Assurance Levels do Supabase.
 *
 * currentLevel/nextLevel:
 *   aal1 / aal1  -> nenhum fator cadastrado. Pode usar o painel; deve cadastrar.
 *   aal1 / aal2  -> fator cadastrado, mas ESTA sessão só passou por senha.
 *                   Precisa do desafio TOTP antes de liberar o painel.
 *   aal2 / aal2  -> segundo fator já verificado nesta sessão. Liberado.
 *
 * Checar apenas "existe sessão?" burlaria o MFA: signInWithPassword já cria
 * sessão (em aal1) mesmo com fator cadastrado. Por isso o gate usa o AAL.
 */
export type MfaStatus =
  | { state: 'loading' }
  | { state: 'no-factor' }        // aal1/aal1 — nada cadastrado
  | { state: 'needs-challenge' }  // aal1/aal2 — precisa digitar o código
  | { state: 'verified' }         // aal2/aal2 — ok
  | { state: 'error'; message: string };

export function useMfaStatus(): { status: MfaStatus; refresh: () => void } {
  const [status, setStatus] = useState<MfaStatus>({ state: 'loading' });

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) {
      setStatus({ state: 'error', message: error.message });
      return;
    }
    const { currentLevel, nextLevel } = data;
    if (currentLevel === 'aal2') {
      setStatus({ state: 'verified' });
    } else if (nextLevel === 'aal2') {
      setStatus({ state: 'needs-challenge' });
    } else {
      setStatus({ state: 'no-factor' });
    }
  }, []);

  useEffect(() => {
    refresh();
    // Reavalia quando o auth muda (login, verify, logout).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => refresh());
    return () => subscription.unsubscribe();
  }, [refresh]);

  return { status, refresh };
}

/** Retorna o primeiro fator TOTP verificado, ou null. */
export async function getVerifiedTotpFactorId(): Promise<string | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return null;
  const totp = data.totp?.find(f => f.status === 'verified');
  return totp?.id ?? null;
}
