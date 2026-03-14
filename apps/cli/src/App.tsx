import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { BANNER_LINES, defaultTheme } from '@ahmed-moghazy/shared';
import { useBannerAnimation } from './useBannerAnimation.js';
import MenuMode from './MenuMode.js';
import CommandMode from './CommandMode.js';
import ChatMode from './ChatMode.js';

type Mode = 'menu' | 'command' | 'chat';

export default function App() {
  const [mode, setMode] = useState<Mode>('menu');
  const [showBanner, setShowBanner] = useState(true);
  const [animationTrigger, setAnimationTrigger] = useState(0);
  const prevShowBanner = useRef(showBanner);

  const { visibleLineCount, subtitleText, isAnimating, skip } =
    useBannerAnimation(animationTrigger);

  useEffect(() => {
    if (showBanner && !prevShowBanner.current) {
      setAnimationTrigger((t) => t + 1);
    }
    prevShowBanner.current = showBanner;
  }, [showBanner]);

  useInput((_input, _key) => {
    if (showBanner && isAnimating) {
      skip();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      {showBanner && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color={defaultTheme.primary}>
            {BANNER_LINES.slice(0, visibleLineCount).join('\n')}
          </Text>
          <Text bold>{subtitleText}</Text>
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
