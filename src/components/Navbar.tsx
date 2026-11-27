import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { AlertTriangle, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getThemeShortLabel, getThemeToggleLabel } from '../shared/theme';
import { BrandLogo } from './BrandLogo';
import { CreditIndicator } from './CreditIndicator';

export function Navbar() {
  const { user, logout } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
      isActive
        ? 'text-slate-950 border-violet-700 dark:text-white dark:border-[#8B5CF6]'
        : 'text-slate-700 border-transparent hover:text-slate-950 hover:border-slate-400 dark:text-[#A1A1AA] dark:hover:text-white dark:hover:border-white/30'
    }`;

  const handleLogout = async () => {
    setMobileOpen(false);
    await logout();
    navigate('/');
  };

  const toggleLabel = getThemeToggleLabel(theme);
  const toggleShort = getThemeShortLabel(theme);

  // Aviso de créditos baixos: abaixo de 20 créditos, mostrar alerta com link para /planos.
  const LOW_CREDITS_THRESHOLD = 20;
  const lowCredits = user != null && user.credits < LOW_CREDITS_THRESHOLD;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-300/90 bg-white/95 dark:border-white/10 dark:bg-[#08080C]/90 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Brand lockup */}
        <Link
          to="/"
          aria-label="PromptFace — Página inicial"
          className="inline-flex items-center whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 dark:focus-visible:ring-[#8B5CF6] rounded-lg"
        >
          <BrandLogo size="md" animateEntrance />
        </Link>

        {/* Zone 2: Concise single-line navigation links */}
        <nav aria-label="Navegação principal" className="hidden md:flex items-center gap-6">
          <NavLink to="/" end className={navLinkClass}>
            Início
          </NavLink>
          <NavLink to="/cenarios" className={navLinkClass}>
            Cenários
          </NavLink>
          <NavLink to="/criar" className={navLinkClass}>
            Criar
          </NavLink>
          <NavLink to="/studio" className={navLinkClass}>
            Studio
          </NavLink>
          <NavLink to="/planos" className={navLinkClass}>
            Planos
          </NavLink>
        </nav>

        {/* Zone 3: Theme toggle + single primary action */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <button
            type="button"
            data-testid="theme-toggle-button"
            onClick={toggleTheme}
            aria-pressed={!isDark}
            aria-label={toggleLabel}
            title={toggleLabel}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-300 bg-slate-100 text-slate-950 hover:bg-slate-200 hover:border-slate-500 dark:border-white/15 dark:bg-[#17171F] dark:text-white dark:hover:border-[#8B5CF6] dark:hover:bg-white/10 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 dark:focus-visible:ring-[#8B5CF6]"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4 text-violet-800 shrink-0" aria-hidden="true" />
            )}
            <span className="hidden lg:inline">{toggleShort}</span>
          </button>

          {user ? (
            <>
              <CreditIndicator />
              {lowCredits && (
                <Link
                  to="/planos"
                  aria-label={`Créditos baixos: ${user.credits} créditos restantes. Ver planos para recarregar.`}
                  title="Seus créditos estão acabando — ver planos"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-500/60 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" aria-hidden="true" />
                  <span>
                    Recarregar
                  </span>
                </Link>
              )}
              <Link
                to="/meu-espaco"
                className="px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-[#A855F7] to-[#EC4899] shadow-lg shadow-[#7C3AED]/25 hover:brightness-110 transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
              >
                Meu Espaço
              </Link>
            </>
          ) : (
            <Link
              to="/login"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-[#A855F7] to-[#EC4899] shadow-lg shadow-[#7C3AED]/25 hover:brightness-110 transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
            >
              Entrar
            </Link>
          )}
        </div>

        {/* Mobile controls: credit indicator + theme toggle + menu trigger */}
        <div className="md:hidden flex items-center gap-2 shrink-0">
          {user && <CreditIndicator compact />}
          <button
            type="button"
            data-testid="theme-toggle-button-mobile"
            onClick={toggleTheme}
            aria-pressed={!isDark}
            aria-label={toggleLabel}
            title={toggleLabel}
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-slate-300 bg-slate-100 text-slate-950 hover:bg-slate-200 dark:border-white/15 dark:bg-[#17171F] dark:text-white dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 dark:focus-visible:ring-[#8B5CF6]"
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="w-5 h-5 text-violet-800" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-slate-300 text-slate-950 hover:bg-slate-100 dark:border-white/10 dark:text-white dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 dark:focus-visible:ring-[#8B5CF6]"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-300 bg-white dark:border-white/10 dark:bg-[#08080C] px-4 py-4 space-y-2">
          <nav aria-label="Menu móvel" className="flex flex-col space-y-1">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-3 rounded-xl text-sm font-medium text-slate-950 hover:bg-slate-100 dark:text-white dark:hover:bg-white/5"
            >
              Início
            </Link>
            <Link
              to="/cenarios"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-3 rounded-xl text-sm font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-100 dark:text-[#A1A1AA] dark:hover:text-white dark:hover:bg-white/5"
            >
              Cenários
            </Link>
            <Link
              to="/criar"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-3 rounded-xl text-sm font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-100 dark:text-[#A1A1AA] dark:hover:text-white dark:hover:bg-white/5"
            >
              Criar Foto
            </Link>
            <Link
              to="/studio"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-3 rounded-xl text-sm font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-100 dark:text-[#A1A1AA] dark:hover:text-white dark:hover:bg-white/5"
            >
              PromptFace Studio
            </Link>
            <Link
              to="/planos"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-3 rounded-xl text-sm font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-100 dark:text-[#A1A1AA] dark:hover:text-white dark:hover:bg-white/5"
            >
              Planos e Créditos
            </Link>
            {user ? (
              <>
                <Link
                  to="/perfil-visual"
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-3 rounded-xl text-sm font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-100 dark:text-[#A1A1AA] dark:hover:text-white dark:hover:bg-white/5"
                >
                  Meu Perfil Visual
                </Link>
                <Link
                  to="/meu-espaco"
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 px-4 py-3 rounded-xl text-center text-xs font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-[#A855F7] to-[#EC4899]"
                >
                  Meu Espaço ({user.credits} créditos)
                </Link>
                {lowCredits && (
                  <Link
                    to="/planos"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-center text-sm font-semibold text-amber-700 bg-amber-500/10 border border-amber-500/60 dark:text-amber-300"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" aria-hidden="true" />
                    Créditos baixos: {user.credits} restantes — Ver planos
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-3 text-left rounded-xl text-sm font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-100 dark:text-[#A1A1AA] dark:hover:text-white dark:hover:bg-white/5"
                >
                  Sair da conta
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="mt-2 px-4 py-3 rounded-xl text-center text-xs font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-[#A855F7] to-[#EC4899]"
              >
                Entrar ou Criar Conta
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
