import { Box, Text, useInput } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  IngestPresentation,
  IngestServiceFactory,
  IngestStep,
} from '../operations/ingest/ingest-service';
import { INGEST_STEP_LABELS, INGEST_STEP_ORDER } from '../operations/ingest/ingest-service';
import { Header } from './components/header';
import { InputBox } from './components/input-box';
import { MessageList } from './components/message-list';
import { StatusBar } from './components/status-bar';
import type { Message } from './types';

let nextId = 0;

export interface IngestAppProps {
  filePath: string;
  ingestFactory: IngestServiceFactory;
  maxSourceSize: number;
  vaultPath: string;
  onDone: () => void;
}

type StepStatus = 'pending' | 'active' | 'completed' | 'error';

function makeMessage(role: Message['role'], content: string): Message {
  return { id: String(nextId++), role, content };
}

function stepSymbol(status: StepStatus): string {
  switch (status) {
    case 'completed':
      return '✓';
    case 'active':
      return '●';
    case 'error':
      return '✗';
    default:
      return '○';
  }
}

export function IngestApp({
  filePath,
  ingestFactory,
  maxSourceSize,
  vaultPath,
  onDone,
}: IngestAppProps) {
  const [phase, setPhase] = useState<
    | 'starting'
    | 'pending'
    | 'completed'
    | 'streaming'
    | 'waiting'
    | 'summarizing'
    | 'done'
    | 'error'
    | null
  >(null);
  const [stepStatus, setStepStatus] = useState<Record<IngestStep, StepStatus>>(() => {
    const status: Record<string, StepStatus> = {};
    for (const step of INGEST_STEP_ORDER) {
      status[step] = 'pending';
    }
    return status as Record<IngestStep, StepStatus>;
  });
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

  const onStep = useCallback((step: IngestStep) => {
    setStepStatus((prev) => ({ ...prev, [step]: 'active' }));
    setPhase('pending');
  }, []);

  const onStepComplete = useCallback((step: IngestStep) => {
    setStepStatus((prev) => ({ ...prev, [step]: 'completed' }));
    setPhase('completed');
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
    const presentation: IngestPresentation = { onChunk, readInput, onStep, onStepComplete };
    const ingest = ingestFactory.create({ maxSourceSize, vaultPath }, presentation);

    setPhase('starting');
    ingest
      .process(filePath)
      .then(() => {
        setPhase('done');
      })
      .catch((err: Error) => {
        setMessages((prev) => [...prev, makeMessage('error', err.message)]);
        setPhase('error');
      });
  }, [
    filePath,
    ingestFactory,
    maxSourceSize,
    vaultPath,
    onChunk,
    readInput,
    onStep,
    onStepComplete,
  ]);

  return (
    <Box flexDirection="column">
      <Header title={`Ingest: ${filePath}`} />
      <Box flexDirection="column" marginBottom={1} paddingLeft={1} paddingRight={1}>
        {INGEST_STEP_ORDER.map((step) => {
          const status = stepStatus[step];
          const label = INGEST_STEP_LABELS[step];
          const color =
            status === 'active'
              ? 'yellow'
              : status === 'completed'
                ? 'green'
                : status === 'error'
                  ? 'red'
                  : undefined;
          const dimmed = status === 'pending';

          return (
            <Text key={step} color={color} dimColor={dimmed}>
              {stepSymbol(status)} {label}
            </Text>
          );
        })}
      </Box>
      <MessageList messages={messages} />
      {phase === 'waiting' && (
        <InputBox
          placeholder="Type your response (Enter to send, empty to finish)..."
          onSubmit={handleSubmit}
        />
      )}
      {phase === 'streaming' && <StatusBar text="Receiving response..." />}
      {phase === 'summarizing' && <StatusBar text="Summarizing discussion..." />}
      {phase === 'done' && <StatusBar text="Ingest complete. Press Enter to return to menu." />}
      {phase === 'error' && <StatusBar text="An error occurred. Press Enter to return to menu." />}
    </Box>
  );
}
