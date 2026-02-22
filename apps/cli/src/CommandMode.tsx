import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { executeCommand } from '@ahmed-moghazy/shared';
import type { CommandOutput } from '@ahmed-moghazy/shared';
import OutputRenderer from './OutputRenderer.js';

interface HistoryEntry {
  input: string;
  output: CommandOutput[];
}

interface Props {
  onSwitchToMenu: () => void;
}

export default function CommandMode({ onSwitchToMenu }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState('');

  useInput((ch, key) => {
    if (key.tab) {
      onSwitchToMenu();
      return;
    }

    if (key.escape) {
      onSwitchToMenu();
      return;
    }

    if (key.return) {
      const value = input.trim();
      if (!value) return;

      if (value.toLowerCase() === 'exit' || value.toLowerCase() === 'quit') {
        process.exit(0);
      }

      const result = executeCommand(value);

      if (result.clear) {
        setHistory([]);
        setInput('');
        return;
      }

      setHistory((prev) => [...prev, { input: value, output: result.output }]);
      setInput('');
      return;
    }

    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      return;
    }

    if (ch && !key.ctrl && !key.meta) {
      setInput((prev) => prev + ch);
    }
  });

  return (
    <Box flexDirection="column">
      {history.map((entry, i) => (
        <Box key={i} flexDirection="column" marginBottom={1}>
          <Text>
            <Text color="#2c84db">$ </Text>
            <Text>{entry.input}</Text>
          </Text>
          <OutputRenderer output={entry.output} />
        </Box>
      ))}

      <Box>
        <Text color="#2c84db">$ </Text>
        <Text>{input}</Text>
        <Text color="#2c84db">_</Text>
      </Box>

      <Text dimColor>Tab/Esc: menu mode | exit: quit | Type &quot;help&quot; for commands</Text>
    </Box>
  );
}
