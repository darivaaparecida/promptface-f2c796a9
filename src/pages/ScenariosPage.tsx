import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
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

  const [categories, setCategories] = useState<CategoryItem[]>(CATEGORIES);
  const [scenarios, setScenarios] = useState<ScenarioItem[]>(INITIAL_SCENARIOS);
  const [selectedCategory, setSelectedCategory] = useState(initialCat);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const paramCat = searchParams.get('categoria') || 'all';
    setSelectedCategory(paramCat);
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/catalog')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (Array.isArray(data.categories)) setCategories(data.categories);
        if (Array.isArray(data.scenarios)) setScenarios(data.scenarios);
      })
      .catch(() => {
        // Keep bundled catalog
      });
  }, []);

  const filtered = useMemo(
    () => filterScenarios(scenarios, selectedCategory, query),
    [scenarios, selectedCategory, query]
  );

  const handleCategorySelect = (catId: string) => {
    setSelectedCategory(catId);
    if (catId === 'all') {
      searchParams.delete('categoria');
    } else {
      searchParams.set('categoria', catId);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const clearFilters = () => {
    setQuery('');
    handleCategorySelect('all');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-[#8B5CF6]">
            Biblioteca completa · {scenarios.length} cenários
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white text-balance">
            Escolha um cenário pronto para personalizar
          </h1>
          <p className="text-sm sm:text-base text-[#A1A1AA]">
            Explore 14 categorias com imagens de demonstração e personalize roupa, ambiente, pose, iluminação e formato antes de gerar.
          </p>
        </div>

        <div className="relative w-full md:w-80 shrink-0">
          <Search
            className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[#17171F] border border-white/15 text-sm text-white placeholder:text-[#A1A1AA]/70 focus:outline-none focus:border-[#8B5CF6]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#A1A1AA] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 14 Category tabs cleanly wrapped in rows on desktop (no horizontal scroll) */}
      <div role="tablist" aria-label="Categorias de cenários" className="flex flex-wrap gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategory === 'all'}
          onClick={() => handleCategorySelect('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            selectedCategory === 'all'
              ? 'bg-[#7C3AED] text-white'
              : 'bg-[#17171F] text-[#A1A1AA] border border-white/10 hover:text-white'
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
                  : 'bg-[#17171F] text-[#A1A1AA] border border-white/10 hover:text-white'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-[#A1A1AA] font-mono-num">
        <span>Exibindo {filtered.length} cenários</span>
        {(selectedCategory !== 'all' || query) && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-[#8B5CF6] hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#17171F] p-12 text-center space-y-4">
          <h2 className="font-display text-lg font-semibold text-white">
            Nenhum cenário encontrado
          </h2>
          <p className="text-sm text-[#A1A1AA] max-w-md mx-auto">
            Não encontramos cenários com os filtros atuais. Você pode limpar os filtros ou usar o modo Criação Livre.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={clearFilters}
              className="px-5 py-2.5 rounded-xl border border-[#7C3AED] text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#7C3AED]/15"
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
              className="group rounded-2xl border border-white/10 bg-[#17171F] overflow-hidden flex flex-col"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <ImageWithFallback
                  src={scenario.image}
                  alt={scenario.title}
                  className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#08080C]/85 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-4 text-[11px] text-[#A1A1AA]">
                  Demonstração · Foto gerada por IA
                </span>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <p className="text-xs text-[#A1A1AA]">{scenario.categoryName}</p>
                  <h2 className="mt-1 font-display text-base font-semibold text-white">
                    {scenario.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-[#A1A1AA] line-clamp-2">
                    {scenario.description}
                  </p>
                </div>

                <Link
                  to={`/criar?cenario=${scenario.id}`}
                  className="inline-flex items-center justify-center px-4 py-3 rounded-xl border border-[#7C3AED] text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#7C3AED]/15 transition-colors"
                >
                  Usar este cenário
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
