# Contract: Inventory build job

## Workflow: `.github/workflows/inventory.yml`

```yaml
on:
  schedule: [{ cron: '17 3 * * *' }]    # nightly, 03:17 UTC
  workflow_dispatch: {}                  # owner-only on-demand rebuild (FR-007)
concurrency: { group: inventory, cancel-in-progress: false }
permissions: { contents: read }
```

**Steps**:
1. Checkout.
2. `setup-node@v4` with Node 20 and the npm cache.
3. `npm ci`.
4. Run `npm run inventory:build -w @ahmed-moghazy/shared` with these environment
   variables:
   - `GH_INVENTORY_TOKEN`: secret
   - `UPSTASH_REDIS_REST_URL`: secret
   - `UPSTASH_REDIS_REST_TOKEN`: secret
   - `INVENTORY_OWNER`: optional variable. It defaults to the GitHub login taken from the
     `contact.github` URL in `content/resume.yaml`.

Target: it finishes within 10 minutes for 150 repos. SC-005 needs a rebuild within 15
minutes of dispatch.

## Script: `packages/shared/scripts/build-inventory.ts`

```text
tsx scripts/build-inventory.ts [--out <file>] [--dry-run] [--owner <login>]
```

| Flag | Behavior |
|---|---|
| (none) | Build, validate, and `SET inventory:v1`. Always writes `inventory:v1:meta` |
| `--out <file>` | Also write the snapshot JSON to a file (local dev: `.inventory/inventory.json`, gitignored) |
| `--dry-run` | Build and validate, then print a summary (repos, techs, excluded count, size). Writes nothing |

**Exit codes**:

| Code | Meaning |
|---|---|
| 0 | Written, or dry-run OK |
| 1 | GitHub or Redis error. The previous snapshot is kept |
| 2 | Validation or invariant failure, or size over 900 KB. The previous snapshot is kept |

**Stdout summary** (also in `$GITHUB_STEP_SUMMARY`):
- repos included, forks skipped, excluded count (never their names)
- techs and packages counts
- skimmed files
- duration and size

## Pure core (unit-tested, no network)

```ts
buildInventory(input: {
  owner: string;
  generatedAt: string;
  aliases: TechAliasMap;
  repos: Array<{
    meta: { name; description; topics; fork; archived; pushedAt; htmlUrl };
    languages: Record<string, number>;               // bytes
    readme: string | null;                           // raw
    manifests: Array<{ path: string; content: string; skimmed: boolean }>;
  }>;
}): InventorySnapshot
```

It is deterministic: the same input always gives byte-identical JSON, with keys and
arrays sorted. That lets tests snapshot it.
