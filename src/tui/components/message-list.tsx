import { Box, Text } from 'ink';
import type { Message } from '../types';

export interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <Box flexDirection="column" paddingLeft={1} paddingRight={1}>
      {messages.map((msg) => {
        const prefix = msg.role === 'user' ? '> ' : msg.role === 'error' ? '! ' : '';
        const color =
          msg.role === 'user'
            ? 'cyan'
            : msg.role === 'error'
              ? 'red'
              : msg.role === 'info'
                ? undefined
                : 'green';

        return (
          <Text key={msg.id} color={color}>
            {prefix}
            {msg.content}
          </Text>
        );
      })}
    </Box>
  );
}
