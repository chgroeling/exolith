// Specification: docs/cross-cutting/identifier-spec.md
// Specification: docs/cross-cutting/slug-spec.md

import { slugify } from './slug';
import type { SlugOptions } from './slug';
import { PAGE_TYPES } from './types';
import type { PageType } from './types';

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
