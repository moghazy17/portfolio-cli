import { recordSurfaceEvent as record, readSurfaceStats as read, type SurfaceEventKind } from '@ahmed-moghazy/shared';
import { redis } from './redis';

export function recordSurfaceEvent(kind: SurfaceEventKind) {
  return record(redis, kind);
}

export function getSurfaceStats(days: number) {
  return read(redis, days);
}
