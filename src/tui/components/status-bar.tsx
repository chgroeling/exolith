import { Box, Text } from 'ink';

export interface StatusBarProps {
  text: string;
}

export function StatusBar({ text }: StatusBarProps) {
  return (
    <Box paddingLeft={1} paddingRight={1} marginTop={1}>
      <Text dimColor>{text}</Text>
    </Box>
  );
}
