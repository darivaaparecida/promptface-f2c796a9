import { Link } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';

export function Footer() {
  return (
    <footer className="border-t border-slate-300 bg-white dark:border-white/10 dark:bg-[#08080C] mt-20 transition-colors duration-200">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          <div>
            <Link
              to="/"
              aria-label="PromptFace — Página inicial"
              className="inline-flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 dark:focus-visible:ring-[#8B5CF6]"
            >
              <BrandLogo size="lg" />
            </Link>
            <p className="mt-2 text-sm text-slate-700 dark:text-[#A1A1AA] max-w-xs leading-relaxed">
              Solte sua imaginação. Onde você quer estar? Fotografias realistas com preservação da sua identidade facial.
            </p>
            <p className="mt-3 text-xs text-slate-600 dark:text-[#A1A1AA]">promptface.com.br</p>
          </div>

          <div className="space-y-2.5">
            <h2 className="font-display text-sm font-semibold text-slate-950 dark:text-white">Plataforma</h2>
            <ul className="space-y-2 text-sm text-slate-700 dark:text-[#A1A1AA]">
              <li>
                <Link to="/cenarios" className="hover:text-slate-950 dark:hover:text-white transition-colors">
                  Biblioteca de 84 cenários
                </Link>
              </li>
              <li>
                <Link to="/criar" className="hover:text-slate-950 dark:hover:text-white transition-colors">
                  Criar fotografia
                </Link>
              </li>
              <li>
                <Link to="/studio" className="hover:text-slate-950 dark:hover:text-white transition-colors">
                  PromptFace Studio
                </Link>
              </li>
              <li>
                <Link to="/planos" className="hover:text-slate-950 dark:hover:text-white transition-colors">
                  Planos e créditos
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h2 className="font-display text-sm font-semibold text-slate-950 dark:text-white">Privacidade e Suporte</h2>
            <ul className="space-y-2 text-sm text-slate-700 dark:text-[#A1A1AA]">
              <li>
                <Link to="/termos" className="hover:text-slate-950 dark:hover:text-white transition-colors">
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link to="/privacidade" className="hover:text-slate-950 dark:hover:text-white transition-colors">
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link to="/lgpd" className="hover:text-slate-950 dark:hover:text-white transition-colors">
                  LGPD e Proteção de Dados
                </Link>
              </li>
              <li>
                <a
                  href="mailto:contato@promptface.com.br"
                  className="hover:text-slate-950 dark:hover:text-white transition-colors"
                >
                  Suporte: contato@promptface.com.br
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-300 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-700 dark:text-[#A1A1AA]">
          <p>© {new Date().getFullYear()} PromptFace. Todos os direitos reservados.</p>
          <p>Referências faciais privadas por padrão · Nunca usadas para treinar modelos.</p>
        </div>
      </div>
    </footer>
  );
}
