import type { PreIngestStep } from '../operations/pre-ingest/pre-ingest-service';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'info' | 'error';
  content: string;
}

export type AppPhase = 'menu' | 'path-input' | 'pre-ingest' | 'ingest';

export type PreIngestPhase =
  | 'starting'
  | 'pending'
  | 'completed'
  | 'streaming'
  | 'waiting'
  | 'ask-discuss'
  | 'summarizing'
  | 'done'
  | 'error';

export type IngestPhase = 'starting' | 'pending' | 'completed' | 'done' | 'error';

export interface MenuItem {
  label: string;
  value: string;
}
