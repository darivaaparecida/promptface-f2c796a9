import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 border-b ${
      isActive
        ? 'text-white border-[#8B5CF6]'
        : 'text-[#A1A1AA] border-transparent hover:text-white hover:border-white/30'
    }`;

  const handleLogout = async () => {
    setMobileOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08080C]/90 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark only */}
        <Link
          to="/"
          className="font-display text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] rounded"
        >
          PromptFace
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

        {/* Zone 3: Single primary action */}
        <div className="hidden md:flex items-center shrink-0">
          {user ? (
            <Link
              to="/meu-espaco"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-[#A855F7] to-[#EC4899] shadow-lg shadow-[#7C3AED]/25 hover:brightness-110 transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
            >
              Meu Espaço · {user.credits} cr
            </Link>
          ) : (
            <Link
              to="/login"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-[#A855F7] to-[#EC4899] shadow-lg shadow-[#7C3AED]/25 hover:brightness-110 transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
            >
              Entrar
            </Link>
          )}
        </div>

        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
          className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl border border-white/10 text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#08080C] px-4 py-4 space-y-2">
          <nav aria-label="Menu móvel" className="flex flex-col space-y-1">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-3 rounded-xl text-sm font-medium text-white hover:bg-white/5"
            >
              Início
            </Link>
            <Link
              to="/cenarios"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-3 rounded-xl text-sm font-medium text-[#A1A1AA] hover:text-white hover:bg-white/5"
            >
              Cenários
            </Link>
            <Link
              to="/criar"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-3 rounded-xl text-sm font-medium text-[#A1A1AA] hover:text-white hover:bg-white/5"
            >
              Criar Foto
            </Link>
            <Link
              to="/studio"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-3 rounded-xl text-sm font-medium text-[#A1A1AA] hover:text-white hover:bg-white/5"
            >
              PromptFace Studio
            </Link>
            <Link
              to="/planos"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-3 rounded-xl text-sm font-medium text-[#A1A1AA] hover:text-white hover:bg-white/5"
            >
              Planos e Créditos
            </Link>
            {user ? (
              <>
                <Link
                  to="/perfil-visual"
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-3 rounded-xl text-sm font-medium text-[#A1A1AA] hover:text-white hover:bg-white/5"
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
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-3 text-left rounded-xl text-sm font-medium text-[#A1A1AA] hover:text-white hover:bg-white/5"
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
