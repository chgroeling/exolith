export const PAGE_TYPES = ['source', 'entity', 'concept', 'synthesis', 'report'] as const;

export type PageType = (typeof PAGE_TYPES)[number];
