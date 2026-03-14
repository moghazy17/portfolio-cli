import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BANNER_LINES,
  WELCOME_SUBTITLE,
  BANNER_LINE_DELAY_MS,
  SUBTITLE_CHAR_DELAY_MS,
} from '@ahmed-moghazy/shared';

interface BannerAnimationState {
  visibleLineCount: number;
  subtitleText: string;
  isAnimating: boolean;
  isComplete: boolean;
  skip: () => void;
}

export function useBannerAnimation(trigger: number = 0): BannerAnimationState {
  const [visibleLineCount, setVisibleLineCount] = useState(0);
  const [subtitleText, setSubtitleText] = useState('');
  const [isAnimating, setIsAnimating] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skippedRef = useRef(false);

  const skipToEnd = useCallback(() => {
    skippedRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisibleLineCount(BANNER_LINES.length);
    setSubtitleText(WELCOME_SUBTITLE);
    setIsAnimating(false);
    setIsComplete(true);
  }, []);

  useEffect(() => {
    skippedRef.current = false;
    setVisibleLineCount(0);
    setSubtitleText('');
    setIsAnimating(true);
    setIsComplete(false);

    let currentLine = 0;

    function revealNextLine() {
      if (skippedRef.current) return;
      currentLine++;
      setVisibleLineCount(currentLine);
      if (currentLine < BANNER_LINES.length) {
        timerRef.current = setTimeout(revealNextLine, BANNER_LINE_DELAY_MS);
      } else {
        let charIndex = 0;
        function typeNextChar() {
          if (skippedRef.current) return;
          charIndex++;
          setSubtitleText(WELCOME_SUBTITLE.slice(0, charIndex));
          if (charIndex < WELCOME_SUBTITLE.length) {
            timerRef.current = setTimeout(typeNextChar, SUBTITLE_CHAR_DELAY_MS);
          } else {
            setIsAnimating(false);
            setIsComplete(true);
          }
        }
        timerRef.current = setTimeout(typeNextChar, SUBTITLE_CHAR_DELAY_MS);
      }
    }

    timerRef.current = setTimeout(revealNextLine, BANNER_LINE_DELAY_MS);

    return () => {
      skippedRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [trigger]);

  return { visibleLineCount, subtitleText, isAnimating, isComplete, skip: skipToEnd };
}
