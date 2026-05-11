import { Box, Text, useInput } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PreIngestPresentation,
  PreIngestServiceFactory,
  PreIngestStep,
} from '../operations/pre-ingest/pre-ingest-service';
import {
  PRE_INGEST_STEP_LABELS,
  PRE_INGEST_STEP_ORDER,
} from '../operations/pre-ingest/pre-ingest-service';
import { Header } from './components/header';
import { InputBox } from './components/input-box';
import { MessageList } from './components/message-list';
import { StatusBar } from './components/status-bar';
import type { Message, PreIngestPhase } from './types';

let nextId = 0;

export interface PreIngestAppProps {
  filePath: string;
  preIngestFactory: PreIngestServiceFactory;
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

export function PreIngestApp({
  filePath,
  preIngestFactory,
  maxSourceSize,
  vaultPath,
  onDone,
}: PreIngestAppProps) {
  const [phase, setPhase] = useState<PreIngestPhase | null>(null);
  const [stepStatus, setStepStatus] = useState<Record<PreIngestStep, StepStatus>>(() => {
    const status: Record<string, StepStatus> = {};
    for (const step of PRE_INGEST_STEP_ORDER) {
      status[step] = 'pending';
    }
    return status as Record<PreIngestStep, StepStatus>;
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const resolveRef = useRef<((value: string) => void) | null>(null);
  const discussResolveRef = useRef<((value: boolean) => void) | null>(null);

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

  const shouldDiscuss = useCallback((): Promise<boolean> => {
    setPhase('ask-discuss');
    return new Promise((resolve) => {
      discussResolveRef.current = resolve;
    });
  }, []);

  const onStep = useCallback((step: PreIngestStep) => {
    setStepStatus((prev) => ({ ...prev, [step]: 'active' }));
    setPhase('pending');
  }, []);

  const onStepComplete = useCallback((step: PreIngestStep) => {
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
    if (key.return && phase === 'done') onDone();
    if (key.return && phase === 'error') onDone();
    if (key.return && phase === 'ask-discuss') {
      discussResolveRef.current?.(true);
      discussResolveRef.current = null;
    }
    if (key.escape && phase === 'ask-discuss') {
      discussResolveRef.current?.(false);
      discussResolveRef.current = null;
    }
  });

  useEffect(() => {
    const presentation: PreIngestPresentation = {
      onChunk,
      readInput,
      shouldDiscuss,
      onStep,
      onStepComplete,
    };
    const preIngest = preIngestFactory.create({ maxSourceSize, vaultPath }, presentation);

    setPhase('starting');
    preIngest
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
    preIngestFactory,
    maxSourceSize,
    vaultPath,
    onChunk,
    readInput,
    shouldDiscuss,
    onStep,
    onStepComplete,
  ]);

  const visibleSteps = PRE_INGEST_STEP_ORDER.filter((step) => stepStatus[step] !== 'pending');

  return (
    <Box flexDirection="column">
      <Header title={`Pre-Ingest: ${filePath}`} />
      <Box flexDirection="column" paddingLeft={1} paddingRight={1}>
        {visibleSteps.map((step) => {
          const status = stepStatus[step];
          const label = PRE_INGEST_STEP_LABELS[step];
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
            <Box key={step} flexDirection="column">
              <Text color={color} dimColor={dimmed}>
                {stepSymbol(status)} {label}
              </Text>
              {step === 'discussing' && (
                <Box flexDirection="column" paddingLeft={2}>
                  {phase === 'ask-discuss' && (
                    <StatusBar text="Discuss this source? Enter=Yes, Esc=Skip" />
                  )}
                  <MessageList messages={messages} />
                  {phase === 'waiting' && (
                    <InputBox
                      placeholder="Type your response (Enter to send, empty to finish)..."
                      onSubmit={handleSubmit}
                    />
                  )}
                  {phase === 'streaming' && <StatusBar text="Receiving response..." />}
                  {phase === 'summarizing' && <StatusBar text="Summarizing discussion..." />}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
      {phase === 'done' && <StatusBar text="Pre-ingest complete. Press Enter to return to menu." />}
      {phase === 'error' && <StatusBar text="An error occurred. Press Enter to return to menu." />}
    </Box>
  );
}
