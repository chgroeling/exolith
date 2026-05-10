export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'info' | 'error';
  content: string;
}

export type AppPhase = 'menu' | 'path-input' | 'ingest';

export type IngestPhase = 'loading' | 'streaming' | 'waiting' | 'summarizing' | 'done' | 'error';

export interface MenuItem {
  label: string;
  value: string;
}
