import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * Lock com teto de espera para as operações de autenticação.
 *
 * Por padrão o supabase-js usa o Navigator LockManager para serializar
 * operações de auth entre abas. Se uma aba (ou uma aba órfã) mantém o lock, as
 * chamadas nas outras esperam INDEFINIDAMENTE: foi o que aconteceu no cadastro
 * de MFA — o verify completava no servidor, mas a resposta nunca voltava para a
 * UI, que girava até um F5 revelar que o fator já estava ativo.
 *
 * Aqui o lock continua sendo respeitado (evita corrida entre abas), mas com
 * limite: se não for adquirido em ~5s, executa sem ele em vez de pendurar a
 * interface para sempre.
 */
async function lockComTimeout<R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  const nav = globalThis.navigator as Navigator & { locks?: LockManager };
  if (!nav?.locks) return fn();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const desistirDaEspera = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), 5_000);
  });

  try {
    const comLock = nav.locks
      .request(name, { mode: 'exclusive' }, async () => fn())
      .then((r) => ({ ok: true as const, r }));

    const resultado = await Promise.race([comLock, desistirDaEspera]);
    if (resultado === 'timeout') {
      console.warn(`[supabase] lock "${name}" não liberado em 5s; prosseguindo sem lock.`);
      return fn();
    }
    return resultado.r;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { lock: lockComTimeout },
});
