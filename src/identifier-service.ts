import type { IdentifierType } from './types';

export interface IdentifierService {
  createId(type: IdentifierType, text: string): string;
  decomposeId(id: string): { type: IdentifierType; slug: string };
}
