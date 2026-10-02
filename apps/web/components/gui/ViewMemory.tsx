'use client';

import { useEffect } from 'react';
import { markGuiSeen, setViewCookie } from '../../lib/view-cookie';

// Remembers the regular page as the visitor's view, however they got here.
export default function ViewMemory() {
  useEffect(() => {
    setViewCookie('gui');
    markGuiSeen();
  }, []);
  return null;
}
