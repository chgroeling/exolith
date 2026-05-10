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
    <Box flexDirection="column" paddingLeft={1} paddingRight={1}>
      {items.map((item, index) => (
        <Text key={item.value}>
          {index === selectedIndex ? '> ' : '  '}
          {item.label}
        </Text>
      ))}
    </Box>
  );
}
