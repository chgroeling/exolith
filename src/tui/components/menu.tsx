import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import type { MenuItem } from '../types';

export interface MenuProps {
  items: MenuItem[];
  onSelect: (value: string) => void;
}

export function Menu({ items, onSelect }: MenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      onSelect(items[selectedIndex].value);
    }
  });

  return (
    <Box flexGrow={1} justifyContent="center" alignItems="center">
      <Box
        flexDirection="column"
        paddingLeft={3}
        paddingRight={3}
        paddingTop={2}
        paddingBottom={2}
        borderStyle="round"
        borderColor="white"
        backgroundColor="#4a4a4a"
      >
        {items.map((item, index) => (
          <Text key={item.value} backgroundColor={index === selectedIndex ? '#6a6a6a' : '#4a4a4a'}>
            {index === selectedIndex ? '> ' : '  '}
            {item.label}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
