// Specification: docs/cross-cutting/slug-spec.md

import slug from 'slug';

export interface SlugOptions {
  /** Locale for non-Latin script transliteration (e.g. 'bg' for Bulgarian Cyrillic) */
  locale?: string;
}

/** Slugifies text: lowercase, hyphens, ASCII-only, symbols removed, fallback hash for empty results */
function slugify(text: string, options?: SlugOptions): string {
  return slug(text, {
    replacement: '-',
    lower: true,
    trim: true,
    fallback: true,
    ...options,
  });
}

export class Slugger {
  constructor(private options?: SlugOptions) {}

  slugify(text: string): string {
    return slugify(text, this.options);
  }
}
