import { Box, Text, useInput } from 'ink';
import { useCallback, useEffect, useState } from 'react';
import type {
  IngestPresentation,
  IngestServiceFactory,
  IngestStep,
} from '../operations/ingest/ingest-service';
import { INGEST_STEP_LABELS, INGEST_STEP_ORDER } from '../operations/ingest/ingest-service';
import { Header } from './components/header';
import { StatusBar } from './components/status-bar';
import type { IngestPhase } from './types';

export interface IngestAppProps {
  filePath: string;
  ingestFactory: IngestServiceFactory;
  vaultPath: string;
  onDone: () => void;
}

type StepStatus = 'pending' | 'active' | 'completed' | 'error';

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

export function IngestApp({ filePath, ingestFactory, vaultPath, onDone }: IngestAppProps) {
  const [phase, setPhase] = useState<IngestPhase | null>(null);
  const [stepStatus, setStepStatus] = useState<Record<IngestStep, StepStatus>>(() => {
    const status: Record<string, StepStatus> = {};
    for (const step of INGEST_STEP_ORDER) {
      status[step] = 'pending';
    }
    return status as Record<IngestStep, StepStatus>;
  });

  const onStep = useCallback((step: IngestStep) => {
    setStepStatus((prev) => ({ ...prev, [step]: 'active' }));
    setPhase('pending');
  }, []);

  const onStepComplete = useCallback((step: IngestStep) => {
    setStepStatus((prev) => ({ ...prev, [step]: 'completed' }));
    setPhase('completed');
  }, []);

  useInput((_input, key) => {
    if (key.return && (phase === 'done' || phase === 'error')) {
      onDone();
    }
  });

  useEffect(() => {
    const presentation: IngestPresentation = { onStep, onStepComplete };
    const ingest = ingestFactory.create({ vaultPath }, presentation);

    setPhase('starting');
    ingest
      .process(filePath)
      .then(() => {
        setPhase('done');
      })
      .catch(() => {
        setPhase('error');
      });
  }, [filePath, ingestFactory, vaultPath, onStep, onStepComplete]);

  const visibleSteps = INGEST_STEP_ORDER.filter((step) => stepStatus[step] !== 'pending');

  return (
    <Box flexDirection="column">
      <Header title={`Ingest: ${filePath}`} />
      <Box flexDirection="column" paddingLeft={1} paddingRight={1}>
        {visibleSteps.map((step) => {
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
            <Box key={step} flexDirection="column">
              <Text color={color} dimColor={dimmed}>
                {stepSymbol(status)} {label}
              </Text>
            </Box>
          );
        })}
      </Box>
      {phase === 'done' && <StatusBar text="Ingest complete. Press Enter to return to menu." />}
      {phase === 'error' && <StatusBar text="An error occurred. Press Enter to return to menu." />}
    </Box>
  );
}
