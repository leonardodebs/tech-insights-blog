import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * Lock de auth DESLIGADO (pass-through).
 *
 * Por padrão o supabase-js usa o Navigator LockManager para serializar
 * operações de auth entre abas. Nesta aplicação isso causou fricção crônica: o
 * lock ficava preso (aba órfã, DevTools, disputa entre abas) e pendurava login,
 * cadastro/verificação de MFA, logout e troca de senha — cada operação esperava
 * segundos ou travava.
 *
 * O lock só existe para evitar corrida de refresh de token entre MÚLTIPLAS abas
 * fazendo auth ao mesmo tempo. Este é um painel de admin de uso pessoal, operado
 * em uma aba por vez, então esse cenário não se aplica. Passamos um lock que
 * apenas executa a função diretamente, eliminando a classe inteira de travamento.
 */
const noLock = async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { lock: noLock },
});
