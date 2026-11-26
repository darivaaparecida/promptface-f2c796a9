import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Todas as chaves do Supabase vêm SOMENTE de variáveis de ambiente.
// Nenhum valor real pode ser colocado aqui nem em arquivos commitados.
// A service_role SÓ é usada no servidor (nunca chega ao navegador).
export const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || '';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim() || '';
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

let adminClient: SupabaseClient | null = null;

/**
 * Cliente Supabase com a service_role — uso exclusivo do servidor.
 * A service_role ignora o RLS, por isso NUNCA deve ser exposta ao frontend.
 * Lança erro claro quando as variáveis de ambiente não estão configuradas,
 * em vez de falhar com erro críptico do SDK.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.'
    );
  }
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}
