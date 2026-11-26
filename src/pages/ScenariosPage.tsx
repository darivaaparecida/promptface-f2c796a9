import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import {
  CATEGORIES,
  INITIAL_SCENARIOS,
  type CategoryItem,
  type ScenarioItem,
} from '../shared/catalog';
import { filterScenarios } from '../shared/rules';
import { ImageWithFallback } from '../components/ImageWithFallback';

export function ScenariosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCat = searchParams.get('categoria') || 'all';

  const [categories] = useState<CategoryItem[]>(CATEGORIES);
  const [scenarios] = useState<ScenarioItem[]>(INITIAL_SCENARIOS);
  const [selectedCategory, setSelectedCategory] = useState(initialCat);
  const [query, setQuery] = useState('');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  useEffect(() => {
    const paramCat = searchParams.get('categoria') || 'all';
    setSelectedCategory(paramCat);
  }, [searchParams]);

  useEffect(() => {
    if (!mobileFilterOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileFilterOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileFilterOpen]);

  const filtered = useMemo(
    () => filterScenarios(scenarios, selectedCategory, query),
    [scenarios, selectedCategory, query]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of scenarios) {
      counts[s.categoryId] = (counts[s.categoryId] || 0) + 1;
    }
    return counts;
  }, [scenarios]);

  const activeCategoryName = useMemo(() => {
    if (selectedCategory === 'all') return `Todas (${scenarios.length})`;
    return categories.find((c) => c.id === selectedCategory)?.name || 'Todas';
  }, [categories, scenarios.length, selectedCategory]);

  const handleCategorySelect = (catId: string) => {
    setSelectedCategory(catId);
    if (catId === 'all') {
      searchParams.delete('categoria');
    } else {
      searchParams.set('categoria', catId);
    }
    setSearchParams(searchParams, { replace: true });
    setMobileFilterOpen(false);
  };

  const clearFilters = () => {
    setQuery('');
    handleCategorySelect('all');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-14 space-y-5 sm:space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
        <div className="space-y-1.5 sm:space-y-2 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
            Biblioteca completa · {scenarios.length} cenários
          </p>
          <h1 className="font-display text-2xl sm:text-4xl font-bold leading-tight text-slate-950 dark:text-white text-balance">
            Escolha um cenário pronto para personalizar
          </h1>
          <p className="text-sm sm:text-base text-slate-700 dark:text-[#A1A1AA]">
            Explore 14 categorias com imagens de demonstração e personalize roupa, ambiente, pose, iluminação e formato antes de gerar.
          </p>
        </div>

        <div className="relative w-full md:w-80 shrink-0">
          <Search
            className="w-4 h-4 text-slate-600 dark:text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <label htmlFor="scenarios-search" className="sr-only">
            Buscar cenários por título, tema ou categoria
          </label>
          <input
            id="scenarios-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cenário (ex.: Dubai, CEO, Paris)"
            className="w-full min-h-[44px] pl-10 pr-9 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-950 placeholder:text-slate-500 dark:bg-[#17171F] dark:border-white/15 dark:text-white dark:placeholder:text-[#A1A1AA]/70 focus:outline-none focus:border-[#8B5CF6]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile: compact category selector trigger (replaces 8 rows of wrapped buttons) */}
      <div className="flex sm:hidden items-center gap-2">
        <button
          type="button"
          data-testid="mobile-category-filter-trigger"
          aria-expanded={mobileFilterOpen}
          aria-haspopup="dialog"
          onClick={() => setMobileFilterOpen(true)}
          className={`flex-1 min-w-0 min-h-[44px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 text-sm transition-colors ${
            selectedCategory !== 'all'
              ? 'border-violet-600 bg-violet-50 text-violet-950 dark:border-[#8B5CF6]/60 dark:bg-[#7C3AED]/15 dark:text-white'
              : 'border-slate-300 bg-white text-slate-900 dark:border-white/15 dark:bg-[#17171F] dark:text-white'
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <SlidersHorizontal
              className="w-4 h-4 shrink-0 text-violet-700 dark:text-[#A855F7]"
              aria-hidden="true"
            />
            <span className="text-slate-600 dark:text-[#A1A1AA] shrink-0">Categoria:</span>
            <span className="font-semibold truncate">{activeCategoryName}</span>
          </span>
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-slate-600 dark:text-[#A1A1AA] transition-transform ${
              mobileFilterOpen ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        {selectedCategory !== 'all' && (
          <button
            type="button"
            onClick={() => handleCategorySelect('all')}
            aria-label="Limpar categoria selecionada"
            className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-300 bg-white text-slate-700 hover:text-slate-950 dark:border-white/15 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:hover:text-white flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Desktop / Tablet: Category tabs cleanly wrapped in rows */}
      <div
        role="tablist"
        aria-label="Categorias de cenários"
        className="hidden sm:flex flex-wrap gap-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategory === 'all'}
          onClick={() => handleCategorySelect('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            selectedCategory === 'all'
              ? 'bg-[#7C3AED] text-white'
              : 'bg-white text-slate-800 border border-slate-300 hover:text-slate-950 hover:border-slate-500 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:border-white/10 dark:hover:text-white'
          }`}
        >
          Todas ({scenarios.length})
        </button>

        {categories.map((cat) => {
          const active = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleCategorySelect(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-white text-slate-800 border border-slate-300 hover:text-slate-950 hover:border-slate-500 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:border-white/10 dark:hover:text-white'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-700 dark:text-[#A1A1AA] font-mono-num">
        <span>Exibindo {filtered.length} cenários</span>
        {(selectedCategory !== 'all' || query) && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-violet-700 dark:text-[#8B5CF6] hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-12 text-center space-y-4">
          <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white">
            Nenhum cenário encontrado
          </h2>
          <p className="text-sm text-slate-700 dark:text-[#A1A1AA] max-w-md mx-auto">
            Não encontramos cenários com os filtros atuais. Você pode limpar os filtros ou usar o modo Criação Livre.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={clearFilters}
              className="px-5 py-2.5 rounded-xl border border-violet-700 text-xs font-semibold uppercase tracking-wider text-violet-950 hover:bg-violet-100 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15"
            >
              Limpar filtros
            </button>
            <Link
              to="/criar?modo=livre"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white"
            >
              Ir para Criação Livre
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((scenario) => (
            <article
              key={scenario.id}
              className="group rounded-2xl border border-slate-300 pf-card-surface dark:border-white/10 overflow-hidden flex flex-col"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-900">
                <ImageWithFallback
                  src={scenario.image}
                  alt={scenario.title}
                  className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#08080C]/85 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-4 text-[11px] text-[#E4E4E7]">
                  Demonstração · Foto gerada por IA
                </span>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-600 dark:text-[#A1A1AA]">{scenario.categoryName}</p>
                  <h2 className="mt-1 font-display text-base font-semibold text-slate-950 dark:text-white">
                    {scenario.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-700 dark:text-[#A1A1AA] line-clamp-2">
                    {scenario.description}
                  </p>
                </div>

                <Link
                  to={`/criar?cenario=${scenario.id}`}
                  className="inline-flex items-center justify-center px-4 py-3 rounded-xl border border-violet-700 text-xs font-semibold uppercase tracking-wider text-violet-950 hover:bg-violet-100 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15 transition-colors"
                >
                  Usar este cenário
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Mobile category picker bottom sheet */}
      {mobileFilterOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filtrar cenários por categoria"
          className="fixed inset-0 z-50 sm:hidden bg-black/60 backdrop-blur-sm flex items-end"
          onClick={() => setMobileFilterOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-white dark:bg-[#12121A] border-t border-slate-300 dark:border-white/15 max-h-[80vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              aria-hidden="true"
              className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 mx-auto mt-3 mb-1 shrink-0"
            />
            <div className="px-5 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
                  Filtrar por categoria
                </h2>
                <p className="text-xs text-slate-600 dark:text-[#A1A1AA]">
                  {categories.length} categorias disponíveis
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar filtro de categorias"
                onClick={() => setMobileFilterOpen(false)}
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-[#A1A1AA] dark:hover:text-white dark:hover:bg-white/5"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-3 space-y-1.5 pb-6">
              <button
                type="button"
                onClick={() => handleCategorySelect('all')}
                className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left text-sm font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-[#7C3AED] text-white'
                    : 'bg-slate-50 text-slate-900 hover:bg-slate-100 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/10'
                }`}
              >
                <span>Todas as categorias</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-mono-num ${
                      selectedCategory === 'all' ? 'text-white/90' : 'text-slate-500 dark:text-[#A1A1AA]'
                    }`}
                  >
                    {scenarios.length}
                  </span>
                  {selectedCategory === 'all' && <Check className="w-4 h-4" aria-hidden="true" />}
                </span>
              </button>

              {categories.map((cat) => {
                const active = selectedCategory === cat.id;
                const count = categoryCounts[cat.id] || 0;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySelect(cat.id)}
                    className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[#7C3AED] text-white'
                        : 'bg-slate-50 text-slate-900 hover:bg-slate-100 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/10'
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-mono-num ${
                          active ? 'text-white/90' : 'text-slate-500 dark:text-[#A1A1AA]'
                        }`}
                      >
                        {count}
                      </span>
                      {active && <Check className="w-4 h-4" aria-hidden="true" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
