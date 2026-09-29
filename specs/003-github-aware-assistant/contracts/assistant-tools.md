# Contract: Assistant tools

The tools are defined in `packages/shared/src/assistant/server/tools.ts` and built by
`createAssistantTools(deps, budget)`. The dependencies are injected so that tests and evals
can mock them:

```ts
interface AssistantDeps {
  inventory(): Promise<InventorySnapshot | null>;
  live: {
    currentRepos(): Promise<LiveRepo[]>;              // exclusion source (10 min cache)
    recentActivity(): Promise<RecentActivity[]>;
    repo(name: string): Promise<LiveRepoDetail | null>;
    searchCode(query: string): Promise<CodeHit[]>;
  };
  surface: 'web' | 'ssh';
  origin: string;
}
```

## Rules that apply to every tool

- Every result is JSON. Third-party text appears **only** in fields named
  `untrusted_text`.
- A result serialized for the model is at most 2,000 characters. Truncation is marked
  with `"truncated": true`.
- Every repo in a result must be included: not excluded, not a fork. Tools filter again
  against `live.currentRepos()` when that is available.
- A dependency failure returns `{ "unavailable": true, "what": "github" | "inventory" }`.
  The tool never throws to the model.
- Each call except `decline` uses 1 unit of the per-question budget of 5. After the budget
  is spent, tools are deactivated (research R8).

## `run_command`

```ts
input:  { commandLine: string }      // ≤ 200 chars, e.g. "projects | grep -i rag"
output: { ok: true, commandLine, text: string /* plain-text lines, ≤ 2,000 chars */ }
      | { ok: false, reason: 'not_allowed' | 'parse_error' | 'effect_blocked' | 'failed', detail: string }
```

- Validation: a single pipeline, at most 4 stages, and every stage `assistant: true`
  (research R7).
- It runs through `createShell({ surface, origin }).run(commandLine)` with a 5-second
  timeout.
- If the result has any effect field, the output is discarded and it returns
  `effect_blocked`.
- **Side channel**: on `ok` (and on `failed` with output), the route emits a
  `data-command` part carrying the structured `CommandOutput[]` for rendering. The model
  only sees `text`.

## `lookup_tech`

```ts
input:  { query: string }            // ≤ 60 chars, e.g. "kafka", "vector database"
output: {
  query, matchedTech: { id, label } | null, matchedVia: 'id' | 'alias' | 'package' | 'fuzzy' | null,
  evidence: { repo, file, lastActivity, kind }[],   // ≤ 3, newest first
  totalRepos: number,                               // total repos with code evidence
  readmeOnly: { repo, lastActivity }[],             // only when evidence is empty; ≤ 3
  inventoryGeneratedAt: string, stale: boolean
}
```

**Matching order**:
1. Exact TechId.
2. Label.
3. Alias glob.
4. Raw package name.
5. Fuzzy match: restricted edit distance ≤ 1, only for queries of 5 or more characters,
   reusing `shell/suggest.ts`.

For multi-word category queries (for example "vector database"), it matches techs whose
label or aliases contain every query word, and returns up to 3 matched techs, each with
its top evidence.

**Required model behavior** (prompt, verified by evals):
- `evidence` empty and `readmeOnly` empty → "no public evidence found".
- `readmeOnly` non-empty → "mentioned in <repo>'s README, no code evidence found".

## `list_repos`

```ts
input:  { tech?: string, topic?: string, activeWithinDays?: number, limit?: number /* ≤ 10, default 5 */ }
output: { repos: { name, url, lastActivity, archived, languages: string[], techs: string[], untrusted_text: string /* description */ }[], total: number }
```

## `get_repo`

```ts
input:  { name: string }
output: { name, url, lastActivity, archived, topics, languages, techs,
          evidenceFiles: string[], untrusted_text: string /* description + README excerpt, redacted */ }
      | { notFound: true }          // unknown, private, fork, or excluded: all look identical (FR-006)
```

## `recent_activity`

```ts
input:  {}
output: { since: string /* now − 30 d */, activity: RecentActivity[] /* ≤ 10, newest first */ }
```

## `search_code` (last resort)

```ts
input:  { terms: string }          // ≤ 64 chars of [\w .+#-]
output: { hits: { repo, path, untrusted_text: string /* ≤ 160-char fragment, redacted */ }[] }
      | { rateLimited: true } | { alreadyUsed: true }
```

It is allowed only once per question and is guarded by `rl:assistant:search`.

## `decline`

```ts
input:  { category: 'off_topic' | 'personal' | 'instructions' }
output: { ok: true }
```

It ends the answer (`hasToolCall('decline')`). The route emits `data-decline` and then the
fixed refusal text (chat-api.md).
