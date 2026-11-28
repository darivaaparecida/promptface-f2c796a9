import { useEffect, useState } from 'react';
import {
  CATEGORIES,
  INITIAL_SCENARIOS,
  type CategoryItem,
  type ScenarioItem,
} from './catalog';
import { loadCatalog } from '../lib/db';

/**
 * Catálogo vivo: nasce com o catálogo do código (CATEGORIES /
 * INITIAL_SCENARIOS) e troca pelos dados do Supabase quando chegam.
 * Se a leitura do banco falhar, o site continua com o catálogo do código.
 */
export function useCatalog(): { categories: CategoryItem[]; scenarios: ScenarioItem[] } {
  const [catalog, setCatalog] = useState<{ categories: CategoryItem[]; scenarios: ScenarioItem[] }>({
    categories: CATEGORIES,
    scenarios: INITIAL_SCENARIOS,
  });

  useEffect(() => {
    let alive = true;
    void loadCatalog().then((loaded) => {
      if (alive && loaded) setCatalog(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);

  return catalog;
}
