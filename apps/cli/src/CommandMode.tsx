import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { exec } from 'child_process';
import { executeCommand, getCompletions } from '@ahmed-moghazy/shared';
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
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [savedInput, setSavedInput] = useState<string>('');

  useInput((ch, key) => {
    if (key.tab) {
      if (input.trim()) {
        const completions = getCompletions(input.trim());
        if (completions.length === 1) setInput(completions[0]);
      } else {
        onSwitchToMenu();
      }
      return;
    }

    if (key.escape) {
      onSwitchToMenu();
      return;
    }

    if (key.upArrow) {
      if (inputHistory.length === 0) return;
      if (historyIndex === -1) setSavedInput(input);
      const newIndex = historyIndex < inputHistory.length - 1 ? historyIndex + 1 : historyIndex;
      setHistoryIndex(newIndex);
      setInput(inputHistory[inputHistory.length - 1 - newIndex]);
      return;
    }

    if (key.downArrow) {
      if (historyIndex === -1) return;
      if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput(savedInput);
      } else {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(inputHistory[inputHistory.length - 1 - newIndex]);
      }
      return;
    }

    if (key.return) {
      const value = input.trim();
      if (!value) return;

      if (value.toLowerCase() === 'exit' || value.toLowerCase() === 'quit') {
        process.exit(0);
      }

      setInputHistory((prev) => [...prev, value]);
      setHistoryIndex(-1);
      setSavedInput('');

      const result = executeCommand(value);

      // CLI-only: open URL in browser for `open` command
      const cmdName = value.trim().split(/\s+/)[0].toLowerCase();
      if (cmdName === 'open') {
        const linkOutput = result.output.find((o) => o.type === 'link');
        if (linkOutput && linkOutput.type === 'link') {
          const url = linkOutput.url;
          const opener =
            process.platform === 'win32'  ? `start "" "${url}"` :
            process.platform === 'darwin' ? `open "${url}"` :
                                            `xdg-open "${url}"`;
          exec(opener);
        }
      }

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

      <Text dimColor>Tab/Esc: menu mode | ↑↓: history | exit: quit | Type &quot;help&quot; for commands</Text>
    </Box>
  );
}
