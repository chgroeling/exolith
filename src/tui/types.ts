import type { IngestStep } from '../operations/ingest/ingest-service';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'info' | 'error';
  content: string;
}

export type AppPhase = 'menu' | 'path-input' | 'ingest';

export type IngestPhase =
  | 'starting'
  | 'pending'
  | 'completed'
  | 'streaming'
  | 'waiting'
  | 'summarizing'
  | 'done'
  | 'error';

export interface MenuItem {
  label: string;
  value: string;
}

export type { IngestStep };
