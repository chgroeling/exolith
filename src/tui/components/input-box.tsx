import { Box, Text, useInput } from 'ink';
import { useEffect, useState } from 'react';

export interface InputBoxProps {
  placeholder: string;
  onSubmit: (value: string) => void;
}

export function InputBox({ placeholder, onSubmit }: InputBoxProps) {
  const [value, setValue] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 530);
    return () => clearInterval(id);
  }, []);

  useInput((input, key) => {
    if (key.return) {
      onSubmit(value);
      setValue('');
    } else if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      setValue((prev) => prev + input);
    }
  });

  return (
    <Box paddingLeft={1} paddingRight={1}>
      {value ? (
        <Text>
          {value}
          {cursorVisible ? '\u2588' : ' '}
        </Text>
      ) : (
        <Text dimColor>{placeholder}</Text>
      )}
    </Box>
  );
}
