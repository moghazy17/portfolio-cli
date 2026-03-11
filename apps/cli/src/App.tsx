import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { ASCII_BANNER, WELCOME_SUBTITLE, defaultTheme } from '@ahmed-moghazy/shared';
import MenuMode from './MenuMode.js';
import CommandMode from './CommandMode.js';
import ChatMode from './ChatMode.js';

type Mode = 'menu' | 'command' | 'chat';

export default function App() {
  const [mode, setMode] = useState<Mode>('menu');
  const [showBanner, setShowBanner] = useState(true);

  return (
    <Box flexDirection="column" padding={1}>
      {showBanner && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={defaultTheme.primary}>{ASCII_BANNER}</Text>
          <Text bold>{WELCOME_SUBTITLE}</Text>
          <Text dimColor>
            Use arrow keys to select a section, or press Tab to switch to command mode.
          </Text>
        </Box>
      )}

      {mode === 'menu' ? (
        <MenuMode
          onSwitchToCommand={() => {
            setMode('command');
            setShowBanner(false);
          }}
        />
      ) : mode === 'command' ? (
        <CommandMode
          onSwitchToMenu={() => {
            setMode('menu');
            setShowBanner(true);
          }}
          onEnterChat={() => {
            setMode('chat');
            setShowBanner(false);
          }}
        />
      ) : (
        <ChatMode
          onExit={() => {
            setMode('command');
          }}
        />
      )}
    </Box>
  );
}
