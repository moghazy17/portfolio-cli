import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { getMenuItems, executeCommand } from '@ahmed-moghazy/shared';
import type { CommandOutput } from '@ahmed-moghazy/shared';
import OutputRenderer from './OutputRenderer.js';

interface Props {
  onSwitchToCommand: () => void;
}

export default function MenuMode({ onSwitchToCommand }: Props) {
  const [output, setOutput] = useState<CommandOutput[] | null>(null);
  const [showMenu, setShowMenu] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuItems = getMenuItems();

  useInput((input, key) => {
    if (key.tab) {
      onSwitchToCommand();
      return;
    }

    if (input === 'q') {
      process.exit(0);
    }

    if (key.escape && !showMenu) {
      setOutput(null);
      setShowMenu(true);
      return;
    }

    if (showMenu) {
      if (key.upArrow) {
        setSelectedIndex((i) => (i > 0 ? i - 1 : menuItems.length - 1));
      } else if (key.downArrow) {
        setSelectedIndex((i) => (i < menuItems.length - 1 ? i + 1 : 0));
      } else if (key.return) {
        const result = executeCommand(menuItems[selectedIndex].value);
        setOutput(result.output);
        setShowMenu(false);
      }
    }
  });

  if (!showMenu && output) {
    return (
      <Box flexDirection="column">
        <OutputRenderer output={output} />
        <Text dimColor>
          {'\n'}Press Escape to go back, Tab for command mode, q to quit.
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold color="green">
        {'>'} Select a section:
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {menuItems.map((item, i) => (
          <Text
            key={item.value}
            color={i === selectedIndex ? 'black' : undefined}
            backgroundColor={i === selectedIndex ? 'green' : undefined}
          >
            {i === selectedIndex ? ' > ' : '   '}
            {item.label}
          </Text>
        ))}
      </Box>
      <Text dimColor>
        {'\n'}Tab: command mode | q: quit
      </Text>
    </Box>
  );
}
