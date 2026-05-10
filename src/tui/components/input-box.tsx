import { Box, Text, useInput } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface InputBoxProps {
  placeholder: string;
  onSubmit: (value: string) => void;
}

export function InputBox({ placeholder, onSubmit }: InputBoxProps) {
  const [value, setValue] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);
  const blinkRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const typingRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isTyping = useRef(false);

  const startBlink = useCallback(() => {
    clearInterval(blinkRef.current);
    blinkRef.current = setInterval(() => {
      if (!isTyping.current) {
        setCursorVisible((prev) => !prev);
      }
    }, 530);
  }, []);

  const onTyping = useCallback(() => {
    isTyping.current = true;
    setCursorVisible(true);
    clearTimeout(typingRef.current);
    typingRef.current = setTimeout(() => {
      isTyping.current = false;
      startBlink();
    }, 500);
  }, [startBlink]);

  useEffect(() => {
    startBlink();
    return () => {
      clearInterval(blinkRef.current);
      clearTimeout(typingRef.current);
    };
  }, [startBlink]);

  useInput((input, key) => {
    if (key.return) {
      onSubmit(value);
      setValue('');
    } else if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
      onTyping();
    } else if (input && !key.ctrl && !key.meta) {
      setValue((prev) => prev + input);
      onTyping();
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
