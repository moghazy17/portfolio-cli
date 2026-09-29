# Data Model: GitHub-Aware Assistant

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Types live in `packages/shared/src/inventory/types.ts` (inventory) and
`packages/shared/src/assistant/types.ts` (assistant). zod schemas sit next to them and are
used only on the server and in CI, never in the client bundle.

---

## 1. Technology alias map (`content/tech-aliases.yaml`)

The owner edits this file. It is validated by `content:validate`. See spec entity
*Technology alias map* and FR-004.

```ts
type TechAliasMap = Record<TechId, {
  label: string;            // display name, e.g. "Kafka"
  category: 'language' | 'ai' | 'data' | 'web' | 'infra' | 'tooling' | 'other';
  aliases: string[];        // package / image / action names; '*' glob allowed
}>;
type TechId = string;       // /^[a-z0-9][a-z0-9+.#-]*$/, e.g. "kafka", "c#", "next.js"
```

**Validation**:
- Every `TechId` is unique.
- Aliases are lower-case, non-empty and at most 120 characters.
- A glob has at most one `*`.
- No alias string may appear under two TechIds. The validator reports which two.
- The TechId itself is always an implicit alias.

## 2. Inventory snapshot (Redis `inventory:v1`)

The spec entity *Knowledge base snapshot*. It is replaced only by a complete, valid
rebuild (FR-008).

```ts
interface InventorySnapshot {
  version: 1;
  generatedAt: string;            // ISO-8601 UTC
  owner: string;                  // GitHub login
  repos: Record<RepoName, RepoRecord>;
  techs: Record<TechId, TechEntry>;
  packages: Record<string, EvidenceItem[]>;   // unmapped raw package names → code evidence
  readmeMentions: Record<TechId, ReadmeMention[]>;
  stats: { repoCount: number; techCount: number; topLanguages: { name: string; bytesShare: number; repos: number }[] };
}
```

### RepoRecord (spec entity *Repository record*)

```ts
interface RepoRecord {
  name: string;                   // repo name without owner
  url: string;                    // https://github.com/<owner>/<name>
  description: string | null;     // untrusted text, ≤ 300 chars
  topics: string[];
  languages: { name: string; share: number }[];   // share 0..1; only share ≥ 0.05 kept
  lastActivity: string;           // pushed_at, ISO-8601
  archived: boolean;
  readmeExcerpt: string | null;   // untrusted text; first 3,000 chars, secrets redacted
  techs: TechId[];                // code-level only
  evidenceFiles: string[];        // manifest paths read
  skimmed: string[];              // paths truncated at 100 KB
}
```

### TechEntry (spec entity *Technology*)

```ts
interface TechEntry {
  id: TechId;
  label: string;
  category: TechAliasMap[TechId]['category'];
  evidence: EvidenceItem[];       // sorted by lastActivity desc, then repo name
}
```

### EvidenceItem (spec entity *Evidence item*)

```ts
interface EvidenceItem {
  repo: RepoName;
  file: string;                   // repo-relative path, or "(language statistics)"
  lastActivity: string;           // the repo's pushed_at
  kind: 'manifest' | 'build' | 'container' | 'workflow' | 'language';
  match: string;                  // the package/image/action/language that matched
}
interface ReadmeMention { repo: RepoName; lastActivity: string }
```

**Invariants** (checked by `InventorySchema` plus a `checkInvariants()` pass before the
snapshot is written):

- Repos are exactly the owner's public, non-fork repos that do **not** have the topic
  `portfolio-exclude` at build time (FR-001, FR-006). Excluded names appear **nowhere**,
  including `packages` and `readmeMentions`.
- Every `EvidenceItem.repo` is a key in `repos`.
- Every `techs[t].evidence` is non-empty. There is at most one evidence item per
  (repo, tech), preferring manifest > build > container > workflow > language, then the
  shortest path.
- `readmeMentions` contains only technologies that the README text matches, by TechId,
  label or alias as a whole word (case-insensitive). Mentions never create or change
  `techs` (clarification Q4).
- The serialized size is at most 900 KB.

**Lifecycle**: `absent → current → stale (generatedAt older than 48 h) → current`, which
happens on the next successful rebuild. A failed rebuild leaves the previous snapshot
untouched and writes `inventory:v1:meta.ok = false`.

## 3. Exclusion tag

The spec entity *Exclusion tag*. It is a GitHub topic, `portfolio-exclude`, defined once
as `EXCLUDE_TOPIC` in `packages/shared/src/inventory/constants.ts`.
- **Build time**: the inventory drops tagged repos.
- **Read time**: live tools drop repos that are tagged in the 10-minute-cached current
  repo list (research R9).

## 4. Assistant request and exchange

The spec entity *Assistant exchange*. It is session-only.

```ts
type AssistantSurface = 'web' | 'ssh';

interface AssistantTurn { role: 'user' | 'assistant'; text: string }   // history item

interface AssistantRequest {           // what askAssistant() sends (UI message format on the wire)
  question: string;                    // 1..500 chars after trim
  history: AssistantTurn[];            // ≤ 10 turns (5 exchanges); text only
  surface: AssistantSurface;
}

type AssistantEvent =
  | { type: 'command'; id: string; commandLine: string; output: CommandOutput[]; status: 'ok' | 'error' }
  | { type: 'text'; delta: string }                    // already secret-redacted and markdown-stripped
  | { type: 'sources'; commands: string[]; evidence: { repo: string; file: string }[]; repos: string[] }
  | { type: 'notice'; kind: NoticeKind; message: string; retryAfterSec?: number }
  | { type: 'declined'; category: 'off_topic' | 'personal' | 'instructions' }
  | { type: 'done' };

type NoticeKind = 'limited' | 'daily-cap' | 'unavailable' | 'stale' | 'too-long' | 'error';
```

**Web history entry extension** (`apps/web/hooks/useTerminal.ts`):

```ts
interface AssistantEntryState {
  question: string;
  status: 'thinking' | 'streaming' | 'done' | 'cancelled';
  parts: Array<
    | { kind: 'command'; commandLine: string; output: CommandOutput[] }
    | { kind: 'text'; text: string }
    | { kind: 'sources'; line: string }
    | { kind: 'notice'; notice: NoticeKind; message: string }>;
}
```

**Transitions**: `thinking → streaming` (first event) `→ done`. From `thinking` or
`streaming`, Ctrl+C moves to `cancelled`, and any events after the cancel are dropped.

## 5. `CommandResult` and `CommandDefinition` additions (`packages/shared/src/types.ts`)

```ts
interface CommandResult { /* existing fields */ ask?: { question: string } }
interface CommandDefinition { /* existing fields */ assistant?: boolean }   // may run via run_command
```

- `ask` is an effect: `mergeEffects` includes it.
- The engine never sets `ask` from a registered command, only from the unknown handler.

## 6. Visitor allowance

The spec entity *Visitor allowance*. It is Redis state owned by `@upstash/ratelimit`.

| Key prefix | Algorithm | Identifier | Limit |
|---|---|---|---|
| `rl:assistant:visitor` | sliding window | visitor IP (relay-aware, FR-027a) | 15 per 1 h |
| `rl:assistant:global` | fixed window | `global` | `ASSISTANT_DAILY_CAP` (default 1,000) per 1 d |
| `rl:assistant:search` | sliding window | `global` | 8 per 1 min (GitHub code-search guard) |

## 7. Question log entry (Redis `assistant:log:<YYYY-MM-DD>`, list)

The spec entity *Question log entry* (FR-020a).

```ts
interface QuestionLogEntry {
  at: string;                                 // ISO-8601
  question: string;                           // redacted, ≤ 500 chars
  outcome: 'answered' | 'refused' | 'no_evidence' | 'error' | 'limited';
  sources: { commands: string[]; evidence: string[] };   // "repo/file" strings
  surface: AssistantSurface;
}
```

- It never contains an IP, an identity hash, a session id or a user agent.
- Each day's key has a TTL of 31 days, so entries are gone by day 31 (the spec says
  "deleted after 30 days").
- It is readable only through the token-guarded `/api/chat-stats?log=1`.

## 8. Live GitHub caches (Redis)

| Key | Contents | TTL |
|---|---|---|
| `gh:repos:v1` | `{ name, fork, topics, pushedAt, archived }[]` (current exclusion source) | 10 min |
| `gh:activity:v1` | `RecentActivity[]` (below) | 60 min |
| `gh:readme:v1:<repo>` | redacted README excerpt of at most 3,000 chars | 24 h |
| `gh:search:v1:<sha1(query)>` | `{ repo, path, fragment }[]`, at most 10 results | 24 h |

```ts
interface RecentActivity {
  repo: string;
  lastActivity: string;
  pushes: number;
  kinds: Array<'push' | 'created' | 'release' | 'public'>;
}
```

The existing `github:profile` key used by `github-cache.ts` is kept for the `github`
command's prompt context, and is not part of this feature.
