export const IDENTIFIER_TYPES = [
  'source',
  'entity',
  'concept',
  'synthesis',
  'report',
  'claim',
] as const;

export type IdentifierType = (typeof IDENTIFIER_TYPES)[number];
