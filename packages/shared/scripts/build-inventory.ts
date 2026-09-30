import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { cvData } from '../src/content';
import { loadTechAliases } from '../src/content/node';
import { buildInventory } from '../src/inventory/build';
import { createGitHub, getFileContent, getLanguages, getReadme, getTree, listPublicRepos, selectManifests } from '../src/inventory/github';
import { InventorySnapshotSchema, checkInvariants } from '../src/inventory/schema';
import { isExcludedRepo } from '../src/exclusion';
import { MAX_SNAPSHOT_BYTES } from '../src/inventory/constants';

const started = Date.now();
const args = process.argv.slice(2);
const flag = (name: string) => args[args.indexOf(name) + 1];
const dryRun = args.includes('--dry-run');
const out = args.includes('--out') ? flag('--out') : undefined;
const owner = (args.includes('--owner') ? flag('--owner') : process.env.INVENTORY_OWNER)
  || new URL(cvData.contact.github).pathname.split('/').filter(Boolean)[0];
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
async function setRedis(key: string, value: unknown) {
  if (!url || !token) throw new Error('Redis is not configured');
  const response = await fetch(url, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['SET', key, JSON.stringify(value)]),
  });
  if (!response.ok) throw new Error(`Redis HTTP ${response.status}`);
}
async function summary(text: string) {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, `${text}\n`, { flag: 'a' });
}
async function main() {
  const validArgs = args.every((arg, index) =>
    arg === '--dry-run' || arg === '--out' || arg === '--owner'
    || (index > 0 && ['--out', '--owner'].includes(args[index - 1]) && !arg.startsWith('--')));
  if (!owner || !process.env.GH_INVENTORY_TOKEN || !validArgs
    || (args.includes('--out') && (!out || out.startsWith('--')))
    || (args.includes('--owner') && (!flag('--owner') || flag('--owner').startsWith('--')))) {
    throw new Error('Invalid arguments or missing GitHub token');
  }
  const github = createGitHub(process.env.GH_INVENTORY_TOKEN);
  const aliases = await loadTechAliases(resolve(import.meta.dirname, '../../..'));
  const all = await listPublicRepos(github, owner);
  let next = 0;
  const repos = await Promise.all(Array.from({ length: Math.min(4, all.length) }, async () => {
    const results = [];
    while (next < all.length) {
      const meta = all[next++];
      if (isExcludedRepo(meta)) continue;
      const [languages, readme, tree] = await Promise.all([
        getLanguages(github, owner, meta.name), getReadme(github, owner, meta.name),
        getTree(github, owner, meta.name, meta.defaultBranch),
      ]);
      const manifests = await Promise.all(selectManifests(tree).map(async (path) => ({ path, ...await getFileContent(github, owner, meta.name, path) })));
      results.push({ meta, languages, readme, manifests });
    }
    return results;
  }));
  let snapshot;
  try {
    snapshot = buildInventory({ owner, generatedAt: new Date().toISOString(), aliases, repos: repos.flat() });
  } catch (error) {
    Object.assign(error as Error, { exitCode: 2 });
    throw error;
  }
  const validation = InventorySnapshotSchema.safeParse(snapshot);
  const size = Buffer.byteLength(JSON.stringify(snapshot));
  const errors = [...checkInvariants(snapshot), ...(!validation.success ? validation.error.issues.map((issue) => issue.message) : [])];
  if (size > MAX_SNAPSHOT_BYTES || errors.length) {
    const error = new Error(`Inventory validation failed: ${errors.join('; ')}; ${size} bytes`);
    Object.assign(error, { exitCode: 2 });
    throw error;
  }
  if (!dryRun) {
    if (out) { await mkdir(dirname(resolve(out)), { recursive: true }); await writeFile(resolve(out), JSON.stringify(snapshot)); }
    if (url && token) {
      await setRedis('inventory:v1', snapshot);
      await setRedis('inventory:v1:meta', { generatedAt: snapshot.generatedAt, repoCount: snapshot.stats.repoCount,
        techCount: snapshot.stats.techCount, durationMs: Date.now() - started, ok: true });
    } else if (!out) {
      throw new Error('Redis is not configured');
    }
  }
  await summary(`Repos: ${snapshot.stats.repoCount}; forks skipped: ${all.filter((repo) => repo.fork).length}; excluded: ${all.filter((repo) => !repo.fork && isExcludedRepo(repo)).length}; techs: ${snapshot.stats.techCount}; packages: ${Object.keys(snapshot.packages).length}; skimmed files: ${Object.values(snapshot.repos).reduce((n, repo) => n + repo.skimmed.length, 0)}; duration: ${Date.now() - started} ms; size: ${size} bytes`);
}
main().catch(async (error: Error & { exitCode?: number }) => {
  console.error(error.message);
  if (!dryRun && url && token) {
    try { await setRedis('inventory:v1:meta', { generatedAt: new Date().toISOString(), durationMs: Date.now() - started, ok: false }); } catch { /* preserve the original failure */ }
  }
  process.exitCode = error.exitCode ?? 1;
});
