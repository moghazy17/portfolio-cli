import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { InventorySnapshotSchema } from '@ahmed-moghazy/shared/assistant-server';
import type { InventorySnapshot } from '@ahmed-moghazy/shared/assistant-server';
import { redis } from './redis';

let cached: InventorySnapshot | null = null;
let until = 0;
let logged = false;

export async function getInventory(): Promise<InventorySnapshot | null> {
  if (Date.now() < until) return cached;
  try {
    const localPath = process.env.INVENTORY_FILE || await (async () => {
      const here = resolve(process.cwd(), '.inventory/inventory.json');
      try { await access(here); return here; } catch { return resolve(process.cwd(), '../../.inventory/inventory.json'); }
    })();
    const value: unknown = redis
      ? await redis.get('inventory:v1')
      : JSON.parse(await readFile(localPath, 'utf8'));
    const parsed = InventorySnapshotSchema.safeParse(typeof value === 'string' ? JSON.parse(value) : value);
    cached = parsed.success ? parsed.data : null;
  } catch (error) {
    cached = null;
    if (!logged) { console.error('Inventory unavailable:', error); logged = true; }
  }
  until = Date.now() + 5 * 60_000;
  return cached;
}
