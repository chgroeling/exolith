import { resolve } from 'node:path';
import { Box, useWindowSize } from 'ink';
import { useMemo, useState } from 'react';
import type { IngestServiceFactory } from '../operations/ingest/ingest-service';
import type { PreIngestServiceFactory } from '../operations/pre-ingest/pre-ingest-service';
import { FileBrowser } from './components/file-browser';
import { Header } from './components/header';
import { Menu } from './components/menu';
import { StatusBar } from './components/status-bar';
import { IngestApp } from './ingest-app';
import { PreIngestApp } from './pre-ingest-app';
import type { AppPhase, MenuItem } from './types';

const MENU_ITEMS: MenuItem[] = [
  { label: 'Pre-Ingest (Discuss)', value: 'pre-ingest' },
  { label: 'Ingest (Process Sources)', value: 'ingest' },
  { label: 'Exit', value: 'exit' },
];

export interface AppProps {
  preIngestFactory: PreIngestServiceFactory;
  ingestFactory: IngestServiceFactory;
  maxSourceSize: number;
  vaultPath: string;
}

export function App({ preIngestFactory, ingestFactory, maxSourceSize, vaultPath }: AppProps) {
  const { rows } = useWindowSize();
  const [phase, setPhase] = useState<AppPhase>('menu');
  const [filePath, setFilePath] = useState('');
  const [selectedOperation, setSelectedOperation] = useState<'pre-ingest' | 'ingest'>('pre-ingest');

  const inboxPath = useMemo(() => resolve(vaultPath, 'inbox'), [vaultPath]);
  const sourcesPath = useMemo(() => resolve(vaultPath, 'sources'), [vaultPath]);

  const handleMenuSelect = (value: string) => {
    if (value === 'pre-ingest') {
      setSelectedOperation('pre-ingest');
      setPhase('path-input');
    } else if (value === 'ingest') {
      setSelectedOperation('ingest');
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
    setPhase(selectedOperation);
  };

  const handleCancel = () => {
    setPhase('menu');
    setFilePath('');
  };

  const handleDone = () => {
    setPhase('menu');
    setFilePath('');
  };

  const browserRoot = selectedOperation === 'pre-ingest' ? inboxPath : sourcesPath;
  const headerTitle = selectedOperation === 'pre-ingest' ? 'Pre-Ingest' : 'Ingest';

  return (
    <Box flexDirection="column" height={rows} borderStyle="round" borderColor="white">
      {phase === 'menu' && (
        <>
          <Header title="Exolith" />
          <Menu items={MENU_ITEMS} onSelect={handleMenuSelect} />
          <StatusBar text={'\u2191\u2193 to navigate \u00b7 Enter to select'} />
        </>
      )}
      {phase === 'path-input' && (
        <>
          <Header title={headerTitle} />
          <FileBrowser rootPath={browserRoot} onSubmit={handlePathSubmit} onCancel={handleCancel} />
          <StatusBar text={'\u2191\u2193 to navigate \u00b7 Enter to select \u00b7 Esc to go up'} />
        </>
      )}
      {phase === 'pre-ingest' && (
        <PreIngestApp
          preIngestFactory={preIngestFactory}
          filePath={filePath}
          maxSourceSize={maxSourceSize}
          vaultPath={vaultPath}
          onDone={handleDone}
        />
      )}
      {phase === 'ingest' && (
        <IngestApp
          ingestFactory={ingestFactory}
          filePath={filePath}
          vaultPath={vaultPath}
          onDone={handleDone}
        />
      )}
    </Box>
  );
}
