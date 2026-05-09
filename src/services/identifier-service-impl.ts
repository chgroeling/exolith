// Specification: docs/cross-cutting/identifier-spec.md

import type { SluggerService } from '../slugger-service';
import { IDENTIFIER_TYPES } from '../types';
import type { IdentifierType } from '../types';

export class IdentifierServiceImpl {
  constructor(private slugger: SluggerService) {}

  /** Creates a vault-wide identifier: `{type}.{slug}` (e.g. `'entity.seneca'`) */
  createId(type: IdentifierType, text: string): string {
    if (!IDENTIFIER_TYPES.includes(type)) {
      throw new Error(
        `Invalid identifier type: ${type}. Must be one of: ${IDENTIFIER_TYPES.join(', ')}`,
      );
    }
    return `${type}.${this.slugger.slugify(text)}`;
  }

  /** Splits an identifier into its type and slug components (e.g. `'entity.seneca'` → `{ type: 'entity', slug: 'seneca' }`) */
  decomposeId(id: string): { type: IdentifierType; slug: string } {
    const dotIndex = id.indexOf('.');
    if (dotIndex === -1) {
      throw new Error(`Malformed identifier: missing type prefix in '${id}'`);
    }
    const type = id.slice(0, dotIndex);
    if (!IDENTIFIER_TYPES.includes(type as IdentifierType)) {
      throw new Error(
        `Invalid identifier type: ${type}. Must be one of: ${IDENTIFIER_TYPES.join(', ')}`,
      );
    }
    const slug = id.slice(dotIndex + 1);
    if (slug.length === 0) {
      throw new Error(`Malformed identifier: missing slug in '${id}'`);
    }
    return { type: type as IdentifierType, slug };
  }
}
