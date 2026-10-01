import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { InventorySnapshotSchema } from '@ahmed-moghazy/shared/assistant-server';
import type { InventorySnapshot } from '@ahmed-moghazy/shared/assistant-server';
import { redis } from './redis';

const HIT_TTL_MS = 5 * 60_000;
// A failure (Redis hiccup, missing key, bad snapshot) is retried soon rather than pinned.
const MISS_TTL_MS = 30_000;
const LOG_EVERY_MS = 60_000;

let cached: InventorySnapshot | null = null;
let until = 0;
let lastLog = 0;

function logOnce(message: string, detail: unknown) {
  if (Date.now() - lastLog < LOG_EVERY_MS) return;
  lastLog = Date.now();
  console.error(message, detail);
}

async function localPath(): Promise<string> {
  if (process.env.INVENTORY_FILE) return process.env.INVENTORY_FILE;
  const here = resolve(process.cwd(), '.inventory/inventory.json');
  try { await access(here); return here; } catch { return resolve(process.cwd(), '../../.inventory/inventory.json'); }
}

export async function getInventory(): Promise<InventorySnapshot | null> {
  if (Date.now() < until) return cached;
  cached = null;
  try {
    const value: unknown = redis
      ? await redis.get('inventory:v1')
      : JSON.parse(await readFile(await localPath(), 'utf8'));
    if (value !== null && value !== undefined) {
      const parsed = InventorySnapshotSchema.safeParse(typeof value === 'string' ? JSON.parse(value) : value);
      if (parsed.success) cached = parsed.data;
      else logOnce('Inventory snapshot failed validation:', parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.')}: ${issue.message}`));
    }
  } catch (error) {
    logOnce('Inventory unavailable:', error);
  }
  until = Date.now() + (cached ? HIT_TTL_MS : MISS_TTL_MS);
  return cached;
}
