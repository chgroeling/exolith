import { Box, Text } from 'ink';

export interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <Box paddingLeft={1} paddingRight={1} marginBottom={1}>
      <Text bold>{title}</Text>
    </Box>
  );
}
