// ---------------------------------------------------------------------------
// AuthContext — Supabase Auth direto no navegador (sem servidor Express).
// ---------------------------------------------------------------------------
// O site em produção é só o frontend (Vercel). Login, cadastro e sessão usam
// o Supabase Auth; role/créditos/plano vêm da linha de public.users ligada
// ao usuário (auth_user_id). A confirmação de e-mail é por LINK do próprio
// Supabase Auth — não existe mais o fluxo de código de 6 dígitos (Resend).
// Login com Google continua desativado. Os 10 créditos grátis do cadastro
// vêm de trigger no banco (migração 6), nunca de valor fixado no cliente.
// ---------------------------------------------------------------------------
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { PreferredAiModelId } from '../shared/aiModels';
import {
  DEFAULT_MAINTENANCE_CONFIG,
  type MaintenanceConfig,
} from '../shared/adminStats';
import {
  DEFAULT_FAL_FREE_LIMIT,
  type FalQuotaSummary,
} from '../shared/providerQuota';
import { getSupabase, isSupabaseConfigured, SUPABASE_CONFIG_ERROR } from '../lib/supabase';
import { clearProfileCache, fetchPublicSettings, getMyProfile } from '../lib/db';

import type { BillingInterval, PlanId } from '../shared/catalog';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
  credits: number;
  planId: PlanId;
  billingInterval?: BillingInterval;
  subscriptionStatus: 'inactive' | 'active' | 'canceled' | 'past_due';
  currentPeriodEnd?: string;
  nextMonthlyCreditGrantAt?: string;
  preferredModel?: PreferredAiModelId;
  createdAt: string;
}

export interface PublicConfig {
  /** Geração por IA: false na Fase 1 (chega via Edge Function na Fase 2). */
  geminiConfigured: boolean;
  /** Checkout Stripe: false na Fase 1 (chega via Edge Function na Fase 2). */
  stripeConfigured: boolean;
  /** Login com Google desativado. */
  googleSignInConfigured: boolean;
  /** Admin inicial é configurado pelo SQL/painel do Supabase, não pelo site. */
  needsAdminClaim: boolean;
  /** Sem fluxo de código por e-mail (Resend): a confirmação é por link. */
  resendConfigured: boolean;
  maintenance: MaintenanceConfig;
  falQuota?: FalQuotaSummary;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  config: PublicConfig;
  /** Preenchido quando as variáveis VITE_SUPABASE_* não estão configuradas. */
  configError: string | null;
  /** Verdadeiro quando o usuário chegou pelo link de recuperação de senha. */
  recoveryMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ error?: string; confirmationSent?: boolean }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ error?: string }>;
  resendConfirmation: (email: string) => Promise<{ error?: string }>;
  updateCredits: (credits: number) => void;
  refreshUser: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  logout: () => Promise<void>;
  getMediaUrl: (path: string) => string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEFAULT_CONFIG: PublicConfig = {
  geminiConfigured: false,
  stripeConfigured: false,
  googleSignInConfigured: false,
  needsAdminClaim: false,
  resendConfigured: false,
  maintenance: DEFAULT_MAINTENANCE_CONFIG,
  falQuota: {
    active: false,
    used: 0,
    limit: DEFAULT_FAL_FREE_LIMIT,
    inFlight: 0,
    remaining: DEFAULT_FAL_FREE_LIMIT,
    exhausted: false,
  },
};

function friendlyAuthError(message: string | undefined, fallback: string): string {
  const msg = (message ?? '').toLowerCase();
  if (msg.includes('invalid login credentials') || msg.includes('invalid email or password')) {
    return 'E-mail ou senha incorretos.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Confirme seu e-mail pelo link enviado antes de entrar.';
  }
  if (msg.includes('user already registered') || msg.includes('already registered')) {
    return 'Já existe uma conta com este e-mail.';
  }
  if (msg.includes('password should be at least')) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }
  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
  }
  return fallback;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<PublicConfig>(DEFAULT_CONFIG);
  const [configError, setConfigError] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const initializedRef = useRef(false);

  const refreshConfig = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const settings = await fetchPublicSettings();
      setConfig((prev) => ({
        ...prev,
        maintenance: settings.maintenance,
        falQuota: settings.falQuota,
      }));
    } catch {
      // Mantém os padrões: o site continua navegável sem a manutenção.
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const profile = await getMyProfile();
      setUser(profile);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setConfigError(SUPABASE_CONFIG_ERROR);
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearProfileCache();
        setUser(null);
        setRecoveryMode(false);
        setLoading(false);
        return;
      }
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      }
      if (session) {
        void (async () => {
          try {
            const profile = await getMyProfile();
            setUser(profile);
          } catch {
            setUser(null);
          } finally {
            setLoading(false);
          }
        })();
      } else if (!initializedRef.current) {
        setUser(null);
        setLoading(false);
      }
      initializedRef.current = true;
    });
    void refreshConfig();
    void refreshUser();
    return () => {
      subscription.unsubscribe();
    };
    // Só na montagem: a sessão é gerenciada pelo listener do Supabase Auth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const supabase = getSupabase();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          return { error: friendlyAuthError(error.message, 'Não foi possível entrar.') };
        }
        await refreshUser();
        return {};
      } catch (err) {
        return {
          error:
            err instanceof Error ? err.message : 'Não foi possível entrar.',
        };
      }
    },
    [refreshUser]
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/login?confirmado=1`,
          },
        });
        if (error) {
          return {
            error: friendlyAuthError(error.message, 'Não foi possível criar a conta.'),
          };
        }
        // Com a confirmação por e-mail ativa, não há sessão até o usuário
        // clicar no link. Se o projeto estiver com a confirmação desligada,
        // a sessão já vem criada e o perfil é carregado na hora.
        if (data.session) {
          await refreshUser();
          return {};
        }
        return { confirmationSent: true };
      } catch (err) {
        return {
          error:
            err instanceof Error ? err.message : 'Não foi possível criar a conta.',
        };
      }
    },
    [refreshUser]
  );

  const resetPassword = useCallback(async (email: string) => {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?recuperacao=1`,
      });
      if (error) {
        return {
          error: friendlyAuthError(
            error.message,
            'Não foi possível enviar o link de recuperação.'
          ),
        };
      }
      return {};
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? err.message
            : 'Não foi possível enviar o link de recuperação.',
      };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return {
          error: friendlyAuthError(error.message, 'Não foi possível redefinir a senha.'),
        };
      }
      setRecoveryMode(false);
      return {};
    } catch (err) {
      return {
        error:
          err instanceof Error ? err.message : 'Não foi possível redefinir a senha.',
      };
    }
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) {
        return {
          error: friendlyAuthError(
            error.message,
            'Não foi possível reenviar o link de confirmação.'
          ),
        };
      }
      return {};
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? err.message
            : 'Não foi possível reenviar o link de confirmação.',
      };
    }
  }, []);

  const updateCredits = useCallback((credits: number) => {
    setUser((prev) => (prev ? { ...prev, credits } : prev));
  }, []);

  const logout = useCallback(async () => {
    try {
      if (isSupabaseConfigured()) {
        await getSupabase().auth.signOut();
      }
    } catch {
      // Ignora erros de rede no logout.
    }
    clearProfileCache();
    setRecoveryMode(false);
    setUser(null);
  }, []);

  const getMediaUrl = useCallback((path: string) => {
    // As URLs de mídia já chegam assinadas da camada de dados (db.ts). Esta
    // função só mantém a compatibilidade com os componentes que a recebem.
    return path;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        config,
        configError,
        recoveryMode,
        signIn,
        signUp,
        resetPassword,
        updatePassword,
        resendConfirmation,
        updateCredits,
        refreshUser,
        refreshConfig,
        logout,
        getMediaUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
