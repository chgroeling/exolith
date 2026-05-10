import { Box, useInput } from 'ink';
import { useState } from 'react';
import type { IngestServiceFactory } from '../operations/ingest/ingest-service';
import { Header } from './components/header';
import { InputBox } from './components/input-box';
import { Menu } from './components/menu';
import { StatusBar } from './components/status-bar';
import { IngestApp } from './ingest-app';
import type { AppPhase, MenuItem } from './types';

const MENU_ITEMS: MenuItem[] = [
  { label: 'Process inbox', value: 'process-inbox' },
  { label: 'Exit', value: 'exit' },
];

export interface AppProps {
  ingestFactory: IngestServiceFactory;
  maxSourceSize: number;
  vaultPath: string;
}

export function App({ ingestFactory, maxSourceSize, vaultPath }: AppProps) {
  const [phase, setPhase] = useState<AppPhase>('menu');
  const [filePath, setFilePath] = useState('');

  useInput((_input, key) => {
    if (key.escape && phase === 'path-input') {
      setPhase('menu');
      setFilePath('');
    }
  });

  const handleMenuSelect = (value: string) => {
    if (value === 'process-inbox') {
      setPhase('path-input');
    } else if (value === 'exit') {
      process.exit(0);
    }
  };

  const handlePathSubmit = (path: string) => {
    if (!path.trim()) {
      return;
    }
    setFilePath(path);
    setPhase('ingest');
  };

  const handleIngestDone = () => {
    setPhase('menu');
    setFilePath('');
  };

  return (
    <Box flexDirection="column">
      {phase === 'menu' && (
        <>
          <Header title="Exolith" />
          <Menu items={MENU_ITEMS} onSelect={handleMenuSelect} />
          <StatusBar text="\u2191\u2193 to navigate \u00b7 Enter to select" />
        </>
      )}
      {phase === 'path-input' && (
        <>
          <Header title="Process Inbox" />
          <InputBox placeholder="Enter source file path..." onSubmit={handlePathSubmit} />
          <StatusBar text="Type path and press Enter \u00b7 Esc to go back" />
        </>
      )}
      {phase === 'ingest' && (
        <IngestApp
          ingestFactory={ingestFactory}
          filePath={filePath}
          maxSourceSize={maxSourceSize}
          vaultPath={vaultPath}
          onDone={handleIngestDone}
        />
      )}
    </Box>
  );
}
