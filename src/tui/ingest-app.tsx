import { Box, useInput } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { IngestServiceFactory } from '../operations/ingest/ingest-service';
import { Header } from './components/header';
import { InputBox } from './components/input-box';
import { MessageList } from './components/message-list';
import { StatusBar } from './components/status-bar';
import type { IngestPhase, Message } from './types';

let nextId = 0;

export interface IngestAppProps {
  filePath: string;
  ingestFactory: IngestServiceFactory;
  maxSourceSize: number;
  vaultPath: string;
  onDone: () => void;
}

function makeMessage(role: Message['role'], content: string): Message {
  return { id: String(nextId++), role, content };
}

export function IngestApp({
  filePath,
  ingestFactory,
  maxSourceSize,
  vaultPath,
  onDone,
}: IngestAppProps) {
  const [phase, setPhase] = useState<IngestPhase>('loading');
  const [messages, setMessages] = useState<Message[]>([]);
  const resolveRef = useRef<((value: string) => void) | null>(null);

  const onChunk = useCallback((chunk: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant') {
        return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
      }
      return [...prev, makeMessage('assistant', chunk)];
    });
  }, []);

  const readInput = useCallback((): Promise<string> => {
    setPhase('waiting');
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleSubmit = useCallback((input: string) => {
    if (input) {
      setMessages((prev) => [...prev, makeMessage('user', input)]);
    }
    setPhase(input ? 'streaming' : 'summarizing');
    resolveRef.current?.(input);
    resolveRef.current = null;
  }, []);

  useInput((_input, key) => {
    if (key.return && (phase === 'done' || phase === 'error')) {
      onDone();
    }
  });

  useEffect(() => {
    const ingest = ingestFactory.create({ maxSourceSize, vaultPath }, { onChunk, readInput });

    ingest
      .process(filePath)
      .then(() => {
        setPhase('done');
      })
      .catch((err: Error) => {
        setMessages((prev) => [...prev, makeMessage('error', err.message)]);
        setPhase('error');
      });
  }, [filePath, ingestFactory, maxSourceSize, vaultPath, onChunk, readInput]);

  return (
    <Box flexDirection="column">
      <Header title={`Ingest: ${filePath}`} />
      <MessageList messages={messages} />
      {phase === 'waiting' && (
        <InputBox
          placeholder="Type your response (Enter to send, empty to finish)..."
          onSubmit={handleSubmit}
        />
      )}
      {phase === 'loading' && <StatusBar text="Loading source file..." />}
      {phase === 'streaming' && <StatusBar text="Receiving response..." />}
      {phase === 'summarizing' && <StatusBar text="Summarizing discussion..." />}
      {phase === 'done' && <StatusBar text="Ingest complete. Press Enter to return to menu." />}
      {phase === 'error' && <StatusBar text="An error occurred. Press Enter to return to menu." />}
    </Box>
  );
}
