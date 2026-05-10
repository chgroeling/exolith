/**
 * A terminal file browser dialog for selecting source files.
 * Users can navigate into subdirectories but cannot ascend above rootPath.
 * Only files with supported extensions (.md, .txt, .textile) are shown.
 */

import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Box, Text, useInput } from 'ink';
import { useCallback, useEffect, useState } from 'react';

const SUPPORTED_EXTENSIONS = new Set(['.md', '.txt', '.textile']);

/** Entries in the current directory. */
interface FileEntry {
  name: string;
  isDirectory: boolean;
}

export interface FileBrowserProps {
  rootPath: string;
  onSubmit: (filePath: string) => void;
  onCancel: () => void;
}

function listEntries(dirPath: string): FileEntry[] {
  const dirents = readdirSync(dirPath, { withFileTypes: true });
  return dirents
    .filter(
      (d) => d.isDirectory() || SUPPORTED_EXTENSIONS.has(d.name.slice(d.name.lastIndexOf('.'))),
    )
    .map((d) => ({ name: d.name, isDirectory: d.isDirectory() }))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function FileBrowser({ rootPath, onSubmit, onCancel }: FileBrowserProps) {
  const [currentDir, setCurrentDir] = useState(rootPath);
  const [entries, setEntries] = useState<FileEntry[]>(() => {
    if (!existsSync(rootPath)) return [];
    return listEntries(rootPath);
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!existsSync(currentDir)) {
      setEntries([]);
      setSelectedIndex(0);
      return;
    }
    const fresh = listEntries(currentDir);
    setEntries(fresh);
    setSelectedIndex((prev) => Math.min(prev, Math.max(fresh.length - 1, 0)));
  }, [currentDir]);

  const navigateUp = useCallback(() => {
    if (currentDir === rootPath) return;
    const parent = join(currentDir, '..');
    if (parent.startsWith(rootPath) || parent === rootPath) {
      setCurrentDir(parent);
    }
  }, [currentDir, rootPath]);

  const navigateDown = useCallback((dirName: string) => {
    setCurrentDir((prev) => join(prev, dirName));
  }, []);

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : entries.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < entries.length - 1 ? prev + 1 : 0));
    } else if (key.return && entries.length > 0) {
      const entry = entries[selectedIndex];
      if (entry.isDirectory) {
        navigateDown(entry.name);
      } else {
        onSubmit(join(currentDir, entry.name));
      }
    } else if (key.escape) {
      if (currentDir === rootPath) {
        onCancel();
      } else {
        navigateUp();
      }
    }
  });

  const relativePath =
    currentDir === rootPath ? basename(rootPath) : currentDir.slice(rootPath.length + 1);

  if (!existsSync(rootPath)) {
    return (
      <Box flexDirection="column" paddingLeft={1} paddingRight={1}>
        <Text>Directory does not exist: {rootPath}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingLeft={1} paddingRight={1}>
      <Text dimColor>{relativePath}/</Text>
      {entries.length === 0 && <Text dimColor> (empty)</Text>}
      {entries.map((entry, index) => (
        <Text key={entry.name}>
          {index === selectedIndex ? '> ' : '  '}
          {entry.name}
          {entry.isDirectory ? '/' : ''}
        </Text>
      ))}
    </Box>
  );
}
