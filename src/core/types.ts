/** Valid page types in the wiki vault. */
export const IDENTIFIER_TYPES = [
  'source',
  'entity',
  'concept',
  'synthesis',
  'report',
  'claim',
] as const;

export type IdentifierType = (typeof IDENTIFIER_TYPES)[number];

/** Claim status values. */
export type ClaimStatus = 'active' | 'contested' | 'superseded' | 'deprecated' | 'uncertain';

/** A single verifiable assertion — the atomic knowledge building block of the wiki. */
export interface Claim {
  /** Unique identifier following the pattern `claim.{slug}`. */
  id: string;
  /** Trustworthiness (0.0 – 1.0). */
  confidence: number;
  /** Current lifecycle status. */
  status: ClaimStatus;
  /** The assertion text. */
  text: string;
  /** Mandatory provenance — wikilink to a source. */
  evidence: Evidence;
  /** Methodological or content limitations (optional). */
  limitation?: string;
  /** Optional contextual background. */
  context?: string;
  /** When the claim was last reviewed. */
  updated?: string;
}

/** Proof for a claim — always a wikilink to a Source page. */
export interface Evidence {
  /** Wikilink target, e.g. `sources/schneider-meta-study-2024`. */
  source: string;
  /** Optional location reference (paragraph, line number, page). */
  location?: string;
}

/** Page-level types in the wiki vault. */
export type PageType = Exclude<IdentifierType, 'claim'>;
