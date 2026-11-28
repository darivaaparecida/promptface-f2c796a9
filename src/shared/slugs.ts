/**
 * Gera um slug URL-amigável a partir de um texto em português:
 * tira acentos, minúsculas, troca qualquer sequência de não-alfanuméricos
 * por um hífen e remove hífens das pontas. Usado para ids de categorias
 * e cenários criados no painel admin.
 */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'item';
}
