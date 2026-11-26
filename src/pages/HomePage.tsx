import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Check } from 'lucide-react';
import { motion } from 'motion/react';
import {
  CATEGORIES,
  FAQ_ITEMS,
  HERO_SHOWCASE_IMAGES,
  INITIAL_PLANS,
  INITIAL_SCENARIOS,
  type CategoryItem,
  type PlanDefinition,
  type ScenarioItem,
} from '../shared/catalog';
import { BeforeAfterShowcase } from '../components/BeforeAfterSlider';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { useAuth } from '../context/AuthContext';

export function HomePage() {
  const { user, config } = useAuth();
  const [categories, setCategories] = useState<CategoryItem[]>(CATEGORIES);
  const [scenarios, setScenarios] = useState<ScenarioItem[]>(INITIAL_SCENARIOS);
  const [plans, setPlans] = useState<PlanDefinition[]>(INITIAL_PLANS);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistStatus, setWaitlistStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/catalog')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (Array.isArray(data.categories)) setCategories(data.categories);
        if (Array.isArray(data.scenarios)) setScenarios(data.scenarios);
        if (Array.isArray(data.plans)) setPlans(data.plans);
      })
      .catch(() => {
        // Fallback to static catalog
      });
  }, []);

  const popularScenarios = scenarios.filter((s) => s.popular).slice(0, 6);

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaitlistStatus(null);
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: waitlistEmail, feature: 'payments' }),
    });
    const data = (await res.json()) as { message?: string; error?: string };
    if (res.ok) {
      setWaitlistStatus(data.message || 'Cadastro confirmado na lista de espera.');
      setWaitlistEmail('');
    } else {
      setWaitlistStatus(data.error || 'Verifique o e-mail informado.');
    }
  };

  return (
    <div className="relative overflow-x-hidden">
      {/* Subtle ambient violet glow behind Hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 w-[900px] h-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.12)_0%,rgba(168,85,247,0.05)_45%,transparent_72%)] dark:bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.24)_0%,rgba(168,85,247,0.09)_45%,transparent_72%)] blur-3xl pf-hero-glow"
      />

      {/* HERO SECTION */}
      <section className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-8 pb-14 lg:pt-14 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="lg:col-span-6 space-y-6"
          >
            <p className="text-xs font-medium tracking-wider uppercase text-slate-700 dark:text-[#A1A1AA]">
              Identidade facial preservada · Fotografia realista com IA
            </p>

            <h1 className="font-display text-3xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight leading-[1.08] text-slate-950 dark:text-white text-balance">
              Sua imaginação. Seu rosto. Infinitas possibilidades.
            </h1>

            <p className="text-base sm:text-lg text-slate-700 dark:text-[#A1A1AA] leading-relaxed max-w-xl">
              Crie fotografias incrivelmente realistas de você em qualquer lugar, situação ou estilo usando inteligência artificial.
            </p>

            <div className="flex flex-wrap items-center gap-5 pt-1">
              <Link
                to={user ? '/criar' : '/login?modo=cadastro'}
                className="inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-xl text-xs sm:text-sm font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-[#A855F7] to-[#EC4899] shadow-lg shadow-[#7C3AED]/30 hover:brightness-110 hover:-translate-y-0.5 transition-all min-h-[48px]"
              >
                CRIAR MINHA PRIMEIRA FOTO
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>

              <a
                href="#exemplos"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-950 hover:text-violet-700 dark:text-white dark:hover:text-[#8B5CF6] transition-colors py-2 border-b border-slate-400 hover:border-violet-700 dark:border-white/25 dark:hover:border-[#8B5CF6]"
              >
                Ver exemplos
              </a>
            </div>

            <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">
              10 créditos grátis no cadastro (1 foto gratuita) · Fotos de referência privadas por padrão
            </p>
          </motion.div>

          {/* Right 2x2 grid: SAME person in 4 different scenarios */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="lg:col-span-6"
          >
            <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
              {HERO_SHOWCASE_IMAGES.map((item) => (
                <figure
                  key={item.id}
                  className="group relative aspect-[3/4] rounded-2xl overflow-hidden border border-slate-300 dark:border-white/10 bg-slate-900 dark:bg-[#17171F]"
                >
                  <ImageWithFallback
                    src={item.image}
                    alt={`${item.caption} — Demonstração com o mesmo modelo`}
                    className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08080C]/90 via-[#08080C]/20 to-transparent" />
                  <figcaption className="absolute inset-x-0 bottom-0 p-3 sm:p-3.5">
                    <p className="text-[11px] text-[#D4D4D8]">
                      Demonstração · Foto gerada por IA
                    </p>
                    <p className="text-xs sm:text-sm font-medium text-white truncate">
                      {item.label}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-700 dark:text-[#A1A1AA] text-center lg:text-right">
              Mesma pessoa preservada em 4 cenários diferentes · Modelo de demonstração
            </p>
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 border-t border-slate-300 dark:border-white/10">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
            Como funciona
          </p>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white text-balance">
            Do seu celular para qualquer cenário em três passos
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: '01. Envie seu rosto',
              desc: 'Faça upload de uma ou mais selfies nítidas com consentimento explícito e complete seu Perfil Visual opcional.',
            },
            {
              step: '02. Escolha ou descreva',
              desc: 'Selecione um dos 84 cenários prontos ou escreva livremente onde quer estar, ajustando roupa, pose e iluminação.',
            },
            {
              step: '03. Receba sua foto',
              desc: 'A IA preserva sua identidade facial com pele natural e iluminação realista. Baixe em alta resolução ou edite no Studio.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface p-6 space-y-3 hover:border-violet-600/50 dark:hover:border-[#7C3AED]/40 transition-colors"
            >
              <h3 className="font-display text-lg font-semibold text-slate-950 dark:text-white">{item.step}</h3>
              <p className="text-sm text-slate-700 dark:text-[#A1A1AA] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* EXPLORE 14 CATEGORIES */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 border-t border-slate-300 dark:border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
              Explore possibilidades
            </p>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white">
              14 categorias com 84 cenários prontos
            </h2>
          </div>
          <Link
            to="/cenarios"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-950 hover:text-violet-700 dark:text-white dark:hover:text-[#8B5CF6] transition-colors whitespace-nowrap"
          >
            Ver biblioteca completa
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/cenarios?categoria=${cat.id}`}
              className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-300 dark:border-white/10 bg-slate-900 dark:bg-[#17171F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
            >
              <ImageWithFallback
                src={cat.image}
                alt={cat.name}
                className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#08080C]/95 via-[#08080C]/55 to-[#08080C]/15" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="text-xs text-[#D4D4D8]">6 cenários prontos</p>
                <h3 className="mt-0.5 font-display text-base font-semibold text-white">
                  {cat.name}
                </h3>
                <p className="mt-1 text-xs text-[#D4D4D8] line-clamp-2">{cat.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* POPULAR SCENARIOS */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 border-t border-slate-300 dark:border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
              Cenários populares
            </p>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white">
              Prontos para personalizar com seu rosto
            </h2>
          </div>
          <Link
            to="/cenarios"
            className="text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white transition-colors"
          >
            Explorar todos os 84 cenários
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {popularScenarios.map((scenario) => (
            <article
              key={scenario.id}
              className="group rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface overflow-hidden flex flex-col hover:border-slate-400 dark:hover:border-white/20 transition-colors"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-900">
                <ImageWithFallback
                  src={scenario.image}
                  alt={scenario.title}
                  className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#08080C]/80 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-4 text-[11px] text-[#E4E4E7]">
                  Demonstração · Foto gerada por IA
                </span>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-600 dark:text-[#A1A1AA]">{scenario.categoryName}</p>
                  <h3 className="mt-1 font-display text-base font-semibold text-slate-950 dark:text-white">
                    {scenario.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-700 dark:text-[#A1A1AA] line-clamp-2">
                    {scenario.description}
                  </p>
                </div>
                <Link
                  to={`/criar?cenario=${scenario.id}`}
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-violet-700 text-xs font-semibold uppercase tracking-wider text-violet-950 hover:bg-violet-100 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15 transition-colors"
                >
                  Usar este cenário
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* BEFORE / AFTER EXAMPLES */}
      <section id="exemplos" className="mx-auto max-w-6xl px-4 sm:px-6 py-16 border-t border-slate-300 dark:border-white/10">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
            Exemplos de resultados
          </p>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white text-balance">
            Arraste o controle para comparar selfie e resultado
          </h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-[#A1A1AA]">
            Três pares reais de demonstração mostrando o mesmo rosto preservado entre a foto original e o cenário gerado.
          </p>
        </div>

        <div className="mt-10">
          <BeforeAfterShowcase />
        </div>
      </section>

      {/* PLANS AND PRICING */}
      <section id="planos" className="mx-auto max-w-6xl px-4 sm:px-6 py-16 border-t border-slate-300 dark:border-white/10">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
            Planos e assinaturas
          </p>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white text-balance">
            Comece com 1 foto grátis no cadastro
          </h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-[#A1A1AA]">
            Todo novo cadastro recebe 10 créditos grátis (equivalente a 1 foto). Cada geração, variação ou edição no Studio custa 10 créditos; melhorar descrição custa 1 crédito. Créditos mensais não acumulam.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl p-6 sm:p-8 flex flex-col justify-between border pf-card-surface ${
                plan.highlighted
                  ? 'border-violet-700 dark:border-[#7C3AED] shadow-xl shadow-[#7C3AED]/15'
                  : 'border-slate-300 dark:border-white/10'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-xl font-bold text-slate-950 dark:text-white">{plan.name}</h3>
                  <span className="text-xs text-slate-600 dark:text-[#A1A1AA]">{plan.audience}</span>
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-3xl sm:text-4xl font-bold text-slate-950 dark:text-white font-mono-num">
                    {plan.priceFormatted}
                  </span>
                  <span className="text-sm text-slate-700 dark:text-[#A1A1AA]">/ mês</span>
                </div>
                <p className="mt-1 text-xs font-medium text-violet-700 dark:text-[#8B5CF6] font-mono-num">
                  {plan.creditsMonthly} créditos mensais · até {plan.maxPhotosMonthly} fotos por mês
                </p>

                <p className="mt-3 text-sm text-slate-700 dark:text-[#A1A1AA]">{plan.description}</p>

                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-slate-800 dark:text-white/90">
                      <Check className="w-4 h-4 text-violet-700 dark:text-[#8B5CF6] shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                <Link
                  to={user ? `/planos?selecionar=${plan.id}` : '/login?modo=cadastro'}
                  className={`block w-full text-center px-5 py-3.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                    plan.highlighted
                      ? 'text-white bg-gradient-to-r from-[#A855F7] to-[#EC4899] shadow-lg shadow-[#7C3AED]/25 hover:brightness-110'
                      : 'text-violet-950 border border-violet-700 hover:bg-violet-100 dark:text-white dark:border-[#7C3AED] dark:hover:bg-[#7C3AED]/15'
                  }`}
                >
                  {config.stripeConfigured
                    ? `Assinar plano ${plan.name}`
                    : 'Garantir 1ª foto grátis · Pagamentos em breve'}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {!config.stripeConfigured && (
          <div className="mt-8 rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-950 dark:text-white">
                Assinaturas em breve · Lista de espera prioritária
              </h3>
              <p className="mt-1 text-sm text-slate-700 dark:text-[#A1A1AA]">
                Deixe seu e-mail para ser avisado assim que os pagamentos recorrentes via cartão e Pix Automático estiverem liberados.
              </p>
            </div>
            <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto">
              <label htmlFor="home-waitlist-email" className="sr-only">
                Seu e-mail para lista de espera
              </label>
              <input
                id="home-waitlist-email"
                type="email"
                required
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-950 placeholder:text-slate-500 dark:bg-[#08080C] dark:border-white/15 dark:text-white dark:placeholder:text-[#A1A1AA]/60 focus:outline-none focus:border-[#8B5CF6]"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl border border-violet-700 text-xs font-semibold uppercase tracking-wider text-violet-950 hover:bg-violet-100 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15 transition-colors whitespace-nowrap"
              >
                Avisar-me
              </button>
            </form>
            {waitlistStatus && <p className="text-xs text-violet-700 dark:text-[#8B5CF6]">{waitlistStatus}</p>}
          </div>
        )}
      </section>

      {/* FAQ ACCORDION */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 border-t border-slate-300 dark:border-white/10">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
            Dúvidas frequentes
          </p>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white">
            Perguntas e respostas sobre o PromptFace
          </h2>
        </div>

        <div className="mt-10 space-y-3">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={item.q}
                className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface overflow-hidden"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left hover:bg-slate-100/70 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <span className="font-display text-base font-medium text-slate-950 dark:text-white">{item.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-600 dark:text-[#A1A1AA] shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-violet-700 dark:text-[#8B5CF6]' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-sm text-slate-700 dark:text-[#A1A1AA] leading-relaxed border-t border-slate-200 dark:border-white/5 pt-4">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
