// Specification: docs/cross-cutting/identifier-spec.md

import { IDENTIFIER_TYPES } from './types';
import type { IdentifierType } from './types';

export interface Slugger {
  slugify(text: string): string;
}

export class Identifier {
  constructor(private slugger: Slugger) {}

  /** Creates a vault-wide identifier: `{type}.{slug}` (e.g. `'entity.seneca'`) */
  createId(type: IdentifierType, text: string): string {
    if (!IDENTIFIER_TYPES.includes(type)) {
      throw new Error(
        `Invalid identifier type: ${type}. Must be one of: ${IDENTIFIER_TYPES.join(', ')}`,
      );
    }
    return `${type}.${this.slugger.slugify(text)}`;
  }
}
