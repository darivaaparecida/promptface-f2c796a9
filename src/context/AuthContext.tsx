import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
  credits: number;
  planId: 'free_trial' | 'pro' | 'premium';
  subscriptionStatus: 'inactive' | 'active' | 'canceled' | 'past_due';
  currentPeriodEnd?: string;
  createdAt: string;
}

export interface PublicConfig {
  geminiConfigured: boolean;
  stripeConfigured: boolean;
  googleSignInConfigured: boolean;
  needsAdminClaim: boolean;
  resendConfigured: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  config: PublicConfig;
  setSession: (token: string, user: AuthUser) => void;
  updateCredits: (credits: number) => void;
  refreshUser: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
  getMediaUrl: (path: string) => string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEFAULT_CONFIG: PublicConfig = {
  geminiConfigured: false,
  stripeConfigured: false,
  googleSignInConfigured: false,
  needsAdminClaim: false,
  resendConfigured: false,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<PublicConfig>(DEFAULT_CONFIG);

  const refreshConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config/public');
      if (res.ok) {
        const data = (await res.json()) as PublicConfig;
        setConfig(data);
      }
    } catch {
      // Keep default flags
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/auth/session', {
        headers,
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as {
          authenticated?: boolean;
          user: AuthUser | null;
          token?: string;
        };
        if (data.authenticated && data.user) {
          setUser(data.user);
          if (data.token) setToken(data.token);
        } else {
          setUser(null);
          setToken(null);
        }
      } else {
        setUser(null);
        setToken(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refreshConfig();
    void refreshUser();
    // Only run once on initial mount; cookie restores persistent session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSession = useCallback((newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
  }, []);

  const updateCredits = useCallback((credits: number) => {
    setUser((prev) => (prev ? { ...prev, credits } : prev));
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'PromptFace',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });
    } catch {
      // Ignore network errors on logout
    }
    setToken(null);
    setUser(null);
  }, [token]);

  const apiFetch = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      headers.set('X-Requested-With', 'PromptFace');
      if (init.body && !headers.has('Content-Type') && typeof init.body === 'string') {
        headers.set('Content-Type', 'application/json');
      }
      return fetch(url, {
        ...init,
        headers,
        credentials: 'include',
      });
    },
    [token]
  );

  const getMediaUrl = useCallback(
    (path: string) => {
      if (!path.startsWith('/media/')) return path;
      if (!token) return path;
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}token=${encodeURIComponent(token)}`;
    },
    [token]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        config,
        setSession,
        updateCredits,
        refreshUser,
        refreshConfig,
        logout,
        apiFetch,
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
