'use client';

import { useEffect } from 'react';
import { getTurnstileToken } from '../lib/turnstile-client';

interface Props {
  active: boolean;
  attempt: number;
  onToken: (token: string | null) => void;
}

export default function Turnstile({ active, attempt, onToken }: Props) {
  useEffect(() => {
    if (!active) return;
    let mounted = true;
    getTurnstileToken().then((token) => { if (mounted) onToken(token); })
      .catch(() => { if (mounted) onToken(null); });
    return () => { mounted = false; };
  }, [active, attempt, onToken]);
  return null;
}
