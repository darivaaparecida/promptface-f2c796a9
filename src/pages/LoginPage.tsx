import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  KeyRound,
  Lock,
  Mail,
  ScanFace,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { HERO_SHOWCASE_IMAGES, INITIAL_PLANS } from '../shared/catalog';
import { ImageWithFallback } from '../components/ImageWithFallback';

type AuthMode = 'login' | 'register' | 'verify' | 'forgot' | 'reset' | 'admin-claim';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const initialMode: AuthMode =
    searchParams.get('modo') === 'cadastro' ? 'register' : 'login';

  const { setSession, config, refreshConfig } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    (location.state as { from?: string } | null)?.from || '/criar';

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeHint, setCodeHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showcaseIndex, setShowcaseIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setShowcaseIndex((prev) => (prev + 1) % HERO_SHOWCASE_IMAGES.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        token?: string;
        user?: any;
        requiresVerification?: boolean;
        verificationHint?: string;
        error?: string;
      };

      if (data.requiresVerification) {
        setMode('verify');
        setCodeHint(data.verificationHint || null);
        setInfoMsg('Confirme seu e-mail com o código enviado para acessar sua conta.');
        return;
      }

      if (!res.ok || !data.token || !data.user) {
        setErrorMsg(data.error || 'Não foi possível entrar.');
        return;
      }

      setSession(data.token, data.user);
      navigate(redirectTo, { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password }),
      });
      const data = (await res.json()) as {
        requiresVerification?: boolean;
        verificationHint?: string;
        error?: string;
      };
      if (!res.ok) {
        setErrorMsg(data.error || 'Não foi possível criar a conta.');
        return;
      }
      setCodeHint(data.verificationHint || null);
      setMode('verify');
      setInfoMsg('Cadastro realizado! Confirme seu e-mail para liberar seus 10 créditos grátis.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code }),
      });
      const data = (await res.json()) as { token?: string; user?: any; error?: string };
      if (!res.ok || !data.token || !data.user) {
        setErrorMsg(data.error || 'Código inválido.');
        return;
      }
      setSession(data.token, data.user);
      navigate(redirectTo, { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { resetHint?: string; message?: string };
      setCodeHint(data.resetHint || null);
      setMode('reset');
      setInfoMsg(data.message || 'Informe o código e sua nova senha.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code, newPassword: password }),
      });
      const data = (await res.json()) as { token?: string; user?: any; error?: string };
      if (!res.ok || !data.token || !data.user) {
        setErrorMsg(data.error || 'Não foi possível redefinir a senha.');
        return;
      }
      setSession(data.token, data.user);
      navigate(redirectTo, { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/claim-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name || 'Administrador', email, password }),
      });
      const data = (await res.json()) as { token?: string; user?: any; error?: string };
      if (!res.ok || !data.token || !data.user) {
        setErrorMsg(data.error || 'Não foi possível configurar o administrador.');
        return;
      }
      setSession(data.token, data.user);
      await refreshConfig();
      navigate('/admin', { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleClick = () => {
    setErrorMsg(null);
    setInfoMsg(
      'O login com Google não foi habilitado nesta instância. Crie sua conta ou entre normalmente usando seu e-mail e senha acima.'
    );
  };

  const activeShowcase = HERO_SHOWCASE_IMAGES[showcaseIndex];

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          {/* Left Auth Column */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6 relative overflow-hidden rounded-2xl border border-slate-300 dark:border-white/12 pf-card-surface p-6 sm:p-9 flex flex-col justify-between space-y-6 shadow-sm dark:shadow-none"
          >
            {/* Original PromptFace optical light beam & subtle ambient aura */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-0 right-0 h-px overflow-hidden"
            >
              <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-[#A855F7] to-transparent pf-card-beam" />
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 w-56 h-56 rounded-full bg-[#7C3AED]/10 dark:bg-[#7C3AED]/15 blur-3xl"
            />

            <div className="relative space-y-6">
              {/* Top row: Sliding Auth Switcher + Identity Aperture Mark */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative inline-flex p-1 rounded-xl bg-slate-200 border border-slate-300 dark:bg-[#08080C] dark:border-white/10">
                  {(['login', 'register'] as const).map((tabMode) => {
                    const isActive = mode === tabMode;
                    return (
                      <button
                        key={tabMode}
                        type="button"
                        onClick={() => {
                          setMode(tabMode);
                          setErrorMsg(null);
                          setInfoMsg(null);
                        }}
                        className={`relative z-10 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                          isActive
                            ? 'text-white'
                            : 'text-slate-700 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white'
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="pf-auth-tab"
                            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                            className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#9333EA] shadow-md shadow-[#7C3AED]/30"
                          />
                        )}
                        {tabMode === 'login' ? 'Entrar' : 'Criar conta'}
                      </button>
                    );
                  })}
                </div>

                <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-[#A1A1AA]">
                  <motion.span
                    animate={{ opacity: [0.55, 1, 0.55] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-lg border border-violet-600/40 bg-violet-100 text-violet-800 dark:border-[#8B5CF6]/40 dark:bg-[#7C3AED]/15 dark:text-[#A855F7]"
                  >
                    <ScanFace className="w-3.5 h-3.5" aria-hidden="true" />
                  </motion.span>
                  <span>Estúdio seguro</span>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={`header-${mode}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                >
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                    {mode === 'login' && 'Acesse seu estúdio PromptFace'}
                    {mode === 'register' && 'Crie sua conta com 1 foto grátis'}
                    {mode === 'verify' && 'Confirme seu e-mail'}
                    {mode === 'forgot' && 'Recuperar senha'}
                    {mode === 'reset' && 'Definir nova senha'}
                    {mode === 'admin-claim' && 'Configurar administrador inicial'}
                  </h1>
                  <p className="mt-2 text-sm text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
                    {mode === 'register'
                      ? 'Ao confirmar seu cadastro você recebe 10 créditos grátis para testar sua primeira geração.'
                      : 'Suas referências faciais e galeria ficam protegidas na sua conta.'}
                  </p>
                </motion.div>
              </AnimatePresence>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 border border-red-600/45 text-red-950 dark:bg-red-950/40 dark:border-red-500/40 px-4 py-3 text-xs dark:text-red-200"
                >
                  {errorMsg}
                </div>
              )}

              {infoMsg && (
                <div className="rounded-xl bg-violet-50 border border-violet-600/45 text-violet-950 dark:bg-[#7C3AED]/15 dark:border-[#7C3AED]/40 px-4 py-3 text-xs dark:text-white">
                  {infoMsg}
                </div>
              )}

              <AnimatePresence mode="wait">
                <motion.div
                  key={`form-${mode}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  {mode === 'login' && (
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-1.5">
                        <label htmlFor="login-email" className="block text-xs font-medium text-slate-700 dark:text-[#A1A1AA]">
                          E-mail
                        </label>
                        <div className="relative">
                          <Mail
                            className="w-4 h-4 text-slate-500 dark:text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            aria-hidden="true"
                          />
                          <input
                            id="login-email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="voce@exemplo.com"
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 placeholder:text-slate-500 transition-colors focus:outline-none focus:border-violet-700 focus:ring-2 focus:ring-violet-600/20 dark:bg-[#08080C] dark:border-white/15 dark:text-white dark:placeholder:text-[#A1A1AA]/55 dark:focus:border-[#8B5CF6] dark:focus:ring-[#8B5CF6]/25"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label htmlFor="login-password" className="block text-xs font-medium text-slate-700 dark:text-[#A1A1AA]">
                            Senha
                          </label>
                          <button
                            type="button"
                            onClick={() => setMode('forgot')}
                            className="text-xs font-medium text-violet-700 hover:text-slate-950 dark:text-[#A855F7] dark:hover:text-white transition-colors"
                          >
                            Esqueci minha senha
                          </button>
                        </div>
                        <div className="relative">
                          <Lock
                            className="w-4 h-4 text-slate-500 dark:text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            aria-hidden="true"
                          />
                          <input
                            id="login-password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Sua senha"
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 placeholder:text-slate-500 transition-colors focus:outline-none focus:border-violet-700 focus:ring-2 focus:ring-violet-600/20 dark:bg-[#08080C] dark:border-white/15 dark:text-white dark:placeholder:text-[#A1A1AA]/55 dark:focus:border-[#8B5CF6] dark:focus:ring-[#8B5CF6]/25"
                          />
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.99 }}
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-[#7C3AED]/25 hover:brightness-110 disabled:opacity-50 inline-flex items-center justify-center gap-2 transition-all"
                      >
                        <span>{submitting ? 'Entrando...' : 'Entrar'}</span>
                        {!submitting && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
                      </motion.button>
                    </form>
                  )}

                  {mode === 'register' && (
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="space-y-1.5">
                        <label htmlFor="reg-name" className="block text-xs font-medium text-slate-700 dark:text-[#A1A1AA]">
                          Nome completo
                        </label>
                        <div className="relative">
                          <User
                            className="w-4 h-4 text-slate-500 dark:text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            aria-hidden="true"
                          />
                          <input
                            id="reg-name"
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Seu nome"
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 placeholder:text-slate-500 transition-colors focus:outline-none focus:border-violet-700 focus:ring-2 focus:ring-violet-600/20 dark:bg-[#08080C] dark:border-white/15 dark:text-white dark:placeholder:text-[#A1A1AA]/55 dark:focus:border-[#8B5CF6] dark:focus:ring-[#8B5CF6]/25"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="reg-email" className="block text-xs font-medium text-slate-700 dark:text-[#A1A1AA]">
                          E-mail
                        </label>
                        <div className="relative">
                          <Mail
                            className="w-4 h-4 text-slate-500 dark:text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            aria-hidden="true"
                          />
                          <input
                            id="reg-email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="voce@exemplo.com"
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 placeholder:text-slate-500 transition-colors focus:outline-none focus:border-violet-700 focus:ring-2 focus:ring-violet-600/20 dark:bg-[#08080C] dark:border-white/15 dark:text-white dark:placeholder:text-[#A1A1AA]/55 dark:focus:border-[#8B5CF6] dark:focus:ring-[#8B5CF6]/25"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="reg-password" className="block text-xs font-medium text-slate-700 dark:text-[#A1A1AA]">
                          Senha (mínimo 6 caracteres)
                        </label>
                        <div className="relative">
                          <Lock
                            className="w-4 h-4 text-slate-500 dark:text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            aria-hidden="true"
                          />
                          <input
                            id="reg-password"
                            type="password"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Crie uma senha segura"
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 placeholder:text-slate-500 transition-colors focus:outline-none focus:border-violet-700 focus:ring-2 focus:ring-violet-600/20 dark:bg-[#08080C] dark:border-white/15 dark:text-white dark:placeholder:text-[#A1A1AA]/55 dark:focus:border-[#8B5CF6] dark:focus:ring-[#8B5CF6]/25"
                          />
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.99 }}
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-[#7C3AED]/25 hover:brightness-110 disabled:opacity-50 inline-flex items-center justify-center gap-2 transition-all"
                      >
                        <span>
                          {submitting ? 'Criando conta...' : 'Criar conta e ganhar 10 créditos'}
                        </span>
                        {!submitting && <Sparkles className="w-4 h-4" aria-hidden="true" />}
                      </motion.button>
                    </form>
                  )}

                  {mode === 'verify' && (
                    <form onSubmit={handleVerifyEmail} className="space-y-4">
                      {codeHint && (
                        <div className="rounded-xl border border-slate-300 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-[#08080C] p-3 text-xs dark:text-[#A1A1AA]">
                          Código de confirmação para teste imediato:{' '}
                          <strong className="text-slate-950 dark:text-white font-mono-num">{codeHint}</strong>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <label htmlFor="verify-code" className="block text-xs text-slate-700 dark:text-[#A1A1AA]">
                          Código de 6 dígitos enviado para {email}
                        </label>
                        <input
                          id="verify-code"
                          type="text"
                          required
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          placeholder="000000"
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 font-mono-num focus:outline-none focus:border-violet-700 dark:bg-[#08080C] dark:border-white/15 dark:text-white dark:focus:border-[#8B5CF6]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white"
                      >
                        {submitting ? 'Confirmando...' : 'Confirmar e entrar'}
                      </button>
                    </form>
                  )}

                  {mode === 'forgot' && (
                    <form onSubmit={handleForgot} className="space-y-4">
                      <div className="space-y-1.5">
                        <label htmlFor="forgot-email" className="block text-xs text-slate-700 dark:text-[#A1A1AA]">
                          E-mail cadastrado
                        </label>
                        <input
                          id="forgot-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 focus:outline-none focus:border-violet-700 dark:bg-[#08080C] dark:border-white/15 dark:text-white dark:focus:border-[#8B5CF6]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white"
                      >
                        Enviar código de recuperação
                      </button>
                    </form>
                  )}

                  {mode === 'reset' && (
                    <form onSubmit={handleReset} className="space-y-4">
                      {codeHint && (
                        <div className="rounded-xl border border-slate-300 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-[#08080C] p-3 text-xs dark:text-[#A1A1AA]">
                          Código de recuperação:{' '}
                          <strong className="text-slate-950 dark:text-white font-mono-num">{codeHint}</strong>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <label htmlFor="reset-code" className="block text-xs text-slate-700 dark:text-[#A1A1AA]">
                          Código recebido
                        </label>
                        <input
                          id="reset-code"
                          type="text"
                          required
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 font-mono-num dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="reset-pass" className="block text-xs text-slate-700 dark:text-[#A1A1AA]">
                          Nova senha
                        </label>
                        <input
                          id="reset-pass"
                          type="password"
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white"
                      >
                        Redefinir senha
                      </button>
                    </form>
                  )}

                  {mode === 'admin-claim' && (
                    <form onSubmit={handleClaimAdmin} className="space-y-4">
                      <div className="space-y-1.5">
                        <label htmlFor="admin-name" className="block text-xs text-slate-700 dark:text-[#A1A1AA]">
                          Nome
                        </label>
                        <input
                          id="admin-name"
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="admin-email" className="block text-xs text-slate-700 dark:text-[#A1A1AA]">
                          E-mail do administrador
                        </label>
                        <input
                          id="admin-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="admin-pass" className="block text-xs text-slate-700 dark:text-[#A1A1AA]">
                          Senha de administrador
                        </label>
                        <input
                          id="admin-pass"
                          type="password"
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white"
                      >
                        Definir administrador
                      </button>
                    </form>
                  )}
                </motion.div>
              </AnimatePresence>

              {(mode === 'login' || mode === 'register') && (
                <div className="pt-1 space-y-3">
                  <div className="relative flex items-center justify-center text-xs text-slate-600 dark:text-[#A1A1AA]">
                    <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                    <span className="px-3">ou</span>
                    <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                  </div>

                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={handleGoogleClick}
                    className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-950 text-sm font-medium hover:bg-slate-50 dark:border-white/15 dark:bg-white dark:text-[#08080C] dark:hover:bg-white/95 transition-all shadow-sm"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                    Continuar com Google
                  </motion.button>

                  <div className="pt-2 flex items-center gap-2 text-xs text-slate-700 dark:text-[#A1A1AA]">
                    <ShieldCheck className="w-4 h-4 text-violet-700 dark:text-[#8B5CF6] shrink-0" aria-hidden="true" />
                    <span>Referências faciais privadas por padrão · Protegido por LGPD</span>
                  </div>
                </div>
              )}
            </div>

            {config.needsAdminClaim && mode !== 'admin-claim' && (
              <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 dark:text-[#A1A1AA]">
                <span>Primeira execução</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('admin-claim');
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-violet-700 hover:text-slate-950 dark:text-[#A855F7] dark:hover:text-white transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Configurar admin inicial</span>
                </button>
              </div>
            )}
          </motion.div>

          {/* Right Showcase + Plans Summary */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6 relative overflow-hidden rounded-2xl border border-slate-300 dark:border-white/12 pf-card-surface p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-sm dark:shadow-none"
          >
            {/* Interactive Identity Showcase (dark photographic stage preserved for contrast over portrait) */}
            <div className="rounded-xl overflow-hidden border border-slate-300 dark:border-white/12 bg-[#08080C]">
              <div className="relative h-64 sm:h-72 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeShowcase.image}
                    initial={{ opacity: 0.35, scale: 1.03 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0.35 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="w-full h-full"
                  >
                    <ImageWithFallback
                      src={activeShowcase.image}
                      alt={activeShowcase.caption}
                      className="w-full h-full object-cover object-[50%_18%]"
                    />
                  </motion.div>
                </AnimatePresence>

                {/* Optical focus scan & subtle corner reticle */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-[#A855F7]/75 to-transparent pf-aperture-line"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-3 left-3 w-3.5 h-3.5 border-t-2 border-l-2 border-[#A855F7]/70 rounded-tl-sm"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-3 right-3 w-3.5 h-3.5 border-t-2 border-r-2 border-[#A855F7]/70 rounded-tr-sm"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#08080C] to-transparent"
                />
              </div>

              {/* Clean bottom bar so text NEVER overlaps the person's face */}
              <div className="px-4 py-3 bg-[#08080C] border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-[#A855F7] font-medium">
                    Demonstração · Foto gerada por IA
                  </p>
                  <p className="font-display text-sm sm:text-base font-semibold text-white truncate">
                    {activeShowcase.caption}
                  </p>
                </div>

                <div className="flex items-center gap-1.5" role="tablist" aria-label="Exemplos de cenários">
                  {HERO_SHOWCASE_IMAGES.map((item, idx) => {
                    const isCurrent = idx === showcaseIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={isCurrent}
                        aria-label={`Ver exemplo ${item.label}`}
                        onClick={() => setShowcaseIndex(idx)}
                        className={`h-2 rounded-full transition-all ${
                          isCurrent
                            ? 'w-6 bg-gradient-to-r from-[#A855F7] to-[#EC4899]'
                            : 'w-2 bg-white/25 hover:bg-white/50'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Refined Plans Summary */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
                  Planos claros, sem surpresas
                </h2>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
                  Você começa com <strong className="text-slate-950 dark:text-white">10 créditos grátis</strong> (1 foto gratuita). Depois, escolha quando quiser assinar:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {INITIAL_PLANS.map((plan) => {
                  const isPremium = plan.id === 'premium';
                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-xl border p-4 sm:p-5 flex flex-col justify-between gap-3 transition-colors ${
                        isPremium
                          ? 'border-violet-600 bg-violet-50/75 dark:border-[#8B5CF6]/55 dark:bg-gradient-to-b dark:from-[#7C3AED]/14 dark:via-[#0B0B11] dark:to-[#08080C] shadow-md shadow-[#7C3AED]/10'
                          : 'border-slate-300 bg-slate-50 dark:border-white/10 dark:bg-[#0B0B11]'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-sm font-bold tracking-wide text-slate-950 dark:text-white uppercase">
                            {plan.name}
                          </span>
                          {isPremium && (
                            <span className="px-2 py-0.5 rounded-md bg-violet-700 border border-violet-800 text-white dark:bg-[#7C3AED]/25 dark:border-[#8B5CF6]/40 text-[10px] font-semibold uppercase tracking-wider dark:text-[#E9D5FF] whitespace-nowrap shrink-0">
                              Popular
                            </span>
                          )}
                        </div>

                        <div className="flex items-baseline gap-1">
                          <span className="font-display text-2xl font-bold text-slate-950 dark:text-white font-mono-num">
                            {plan.priceFormatted}
                          </span>
                          <span className="text-xs text-slate-700 dark:text-[#A1A1AA]">/mês</span>
                        </div>

                        <p className="text-xs font-semibold text-violet-800 dark:text-[#C4B5FD] font-mono-num">
                          {plan.creditsMonthly} créditos · até {plan.maxPhotosMonthly} fotos/mês
                        </p>

                        <ul className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
                          {plan.features.slice(0, 3).map((f) => (
                            <li key={f} className="flex items-start gap-2 text-xs text-slate-800 dark:text-white/90 leading-snug">
                              <Check
                                className="w-3.5 h-3.5 text-violet-700 dark:text-[#A855F7] shrink-0 mt-0.5"
                                aria-hidden="true"
                              />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </MotionConfig>
  );
}
