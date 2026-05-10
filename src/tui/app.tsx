import { resolve } from 'node:path';
import { Box } from 'ink';
import { useMemo, useState } from 'react';
import type { IngestServiceFactory } from '../operations/ingest/ingest-service';
import { FileBrowser } from './components/file-browser';
import { Header } from './components/header';
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

  const inboxPath = useMemo(() => resolve(vaultPath, 'inbox'), [vaultPath]);

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

  const handleCancel = () => {
    setPhase('menu');
    setFilePath('');
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
          <StatusBar text={'\u2191\u2193 to navigate \u00b7 Enter to select'} />
        </>
      )}
      {phase === 'path-input' && (
        <>
          <Header title="Process Inbox" />
          <FileBrowser rootPath={inboxPath} onSubmit={handlePathSubmit} onCancel={handleCancel} />
          <StatusBar text={'\u2191\u2193 to navigate \u00b7 Enter to select \u00b7 Esc to go up'} />
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
