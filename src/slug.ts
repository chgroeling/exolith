import slug from 'slug';
import { PAGE_TYPES } from './types.js';
import type { PageType } from './types.js';

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

/** Creates a vault-wide page ID: `{type}.{slug}` (e.g. `'entity.seneca'`) */
export function createPageId(type: PageType, title: string, options?: SlugOptions): string {
  if (!PAGE_TYPES.includes(type)) {
    throw new Error(`Invalid page type: ${type}. Must be one of: ${PAGE_TYPES.join(', ')}`);
  }
  return `${type}.${slugify(title, options)}`;
}

/** Creates a claim identifier: `claim.{slugified-description}` (e.g. `'claim.cortisol-senkung'`) */
export function createClaimSlug(description: string, options?: SlugOptions): string {
  return `claim.${slugify(description, options)}`;
}
