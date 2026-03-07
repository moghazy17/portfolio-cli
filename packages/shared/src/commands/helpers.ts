export function parseTimelineDate(s: string): number {
  if (s === 'Present') return Infinity;
  const MONTHS: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5,
    jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const parts = s.trim().split(/\s+/);
  if (parts.length < 2) return 0;
  return parseInt(parts[1], 10) * 100 + (MONTHS[parts[0].toLowerCase()] ?? 0);
}
