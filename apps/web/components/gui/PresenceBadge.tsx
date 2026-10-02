'use client';

import { usePresence } from '../../hooks/usePresence';

export default function PresenceBadge() {
  const presence = usePresence();
  if (!presence) return null;
  return <span className="hidden whitespace-nowrap rounded-full border border-border px-2 py-1 text-xs text-muted lg:inline">{presence.total} exploring now</span>;
}
