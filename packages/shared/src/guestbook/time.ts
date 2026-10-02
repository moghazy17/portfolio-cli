export function formatRelative(at: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - Date.parse(at)) / 1000));
  if (!Number.isFinite(seconds) || seconds < 60) return 'just now';
  const units: Array<[string, number]> = [['month', 30 * 86400], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of units) {
    if (seconds >= size) {
      const count = Math.floor(seconds / size);
      return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}
