// Cliente Supabase (browser) — PromptFace.
//
// O site em produção é só o frontend (Vercel) e fala DIRETO com o Supabase:
// não existe mais servidor Express em produção e não há Render. As chaves
// aqui são as chaves PUBLICÁVEIS (VITE_*): a anon key é segura para expor no
// navegador — o acesso aos dados é controlado pelas políticas RLS do banco.
// NENHUM valor real de chave pode ser colocado neste arquivo: tudo vem de
// variáveis de ambiente (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export const SUPABASE_CONFIG_ERROR =
  'Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente do projeto (Vercel) e no arquivo .env local.';

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

let client: SupabaseClient | null = null;

/**
 * Retorna o cliente Supabase (singleton). Lança um erro claro se as
 * variáveis de ambiente não estiverem configuradas, em vez de falhar
 * silenciosamente com requisições sem autenticação.
 */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(SUPABASE_CONFIG_ERROR);
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
