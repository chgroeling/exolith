// Specification: docs/cross-cutting/slug-spec.md

import slug from 'slug';

export interface SlugOptions {
  /** Locale for non-Latin script transliteration (e.g. 'bg' for Bulgarian Cyrillic) */
  locale?: string;
}

/** Slugifies text: lowercase, hyphens, ASCII-only, symbols removed, fallback hash for empty results */
export function slugify(text: string, options?: SlugOptions): string {
  return slug(text, {
    replacement: '-',
    lower: true,
    trim: true,
    fallback: true,
    ...options,
  });
}
