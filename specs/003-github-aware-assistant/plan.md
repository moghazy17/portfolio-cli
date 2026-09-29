# Implementation Plan: GitHub-Aware Assistant

**Branch**: `003-github-aware-assistant` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/003-github-aware-assistant/spec.md`

## Summary

This feature turns the existing `/api/chat` chat mode into a tool-using assistant, built
into the shell, that knows all of Ahmed's public GitHub work.

**US1: tech inventory.** A nightly and on-demand GitHub Action runs a `tsx` script that
uses `octokit`.
- **Input**: every public, non-fork repo without the `portfolio-exclude` topic. For each
  one it reads the language stats, topics, description, `pushed_at`, the first 3,000
  characters of the README, and dependency manifests found through one Git Trees call.
- **Normalization**: packages are mapped to technologies through an owner-editable
  `content/tech-aliases.yaml`.
- **Output**: a validated, deterministic snapshot
  (`tech → [{repo, file, lastActivity, kind}]`, `repo → summary`), written atomically to
  Upstash `inventory:v1` with `generatedAt`.
- README mentions are kept apart and never count as "used" (clarification Q4). No vector
  DB.

**US2: AI in the shell.**
- **Unknown input**: a new shared unknown-input handler returns an `ask` effect for
  unknown input. It keeps "did you mean" for one-word typos and never sends piped or curl
  input.
- **Shared client**: `askAssistant()` streams from `/api/chat` and yields host-neutral
  events, so web and SSH behave the same.
- **Server loop**: the route runs AI SDK v6 `streamText` with tools: `run_command`,
  `lookup_tech`, `list_repos` and `get_repo`.
  - `run_command` executes read-only, allowlisted commands on the server through
    `createShell()`. The shell's own pipes can narrow the output (clarification Q1).
  - It streams the real `CommandOutput[]` back as `data-command` parts, which each surface
    renders natively.
  - Budgets: at most 5 tool calls, at most 6 steps, and 400 output tokens per step.
  - A deterministic `data-sources` line cites only what the tools returned.

**US3: freshness and guardrails.**
- **Live tools**: `recent_activity`, which reads public events and applies the live
  exclusion set, and `search_code`, used as a last resort (once per question, cached for
  24 hours).
- **Refusals**: a `decline` tool makes refusals deterministic, and a four-tier scope
  policy decides what is in scope (clarification Q5).
- **Untrusted data**: third-party text is framed as `untrusted_text`, and secrets are
  redacted both when data is collected and in the output stream.
- **Limits**: 15 questions per visitor per hour, relay-aware for SSH (clarification Q3),
  plus a fail-closed daily cap across the site.
- **Question log**: anonymous, kept 30 days (clarification Q2).
- **Evals**: an 18-question golden eval with mocked tools and deterministic assertions.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict). Next.js 15 / React 18 on Vercel. Node 20 for scripts, CI and tests.

**Primary Dependencies**:
- Existing: `ai` 6.0.x (`streamText`, `tool`, `stepCountIs`, `hasToolCall`,
  `DefaultChatTransport`, `MockLanguageModelV3`), `@ai-sdk/openai`, `@ai-sdk/react`,
  `@upstash/redis`, `@upstash/ratelimit`, `zod` 4, `yaml`.
- **New**:
  - `octokit`: a server/CI-only dependency of `packages/shared` (inventory script and
    live tools).
  - `smol-toml`: CI-only, used to parse `pyproject.toml`, `Pipfile` and `Cargo.toml`.
  - `@ai-sdk/google`: server-only, the Gemini fallback model (Constitution 1.1.0; R16).

**Storage**: Upstash Redis (existing). The keys are:
- `inventory:v1` and `inventory:v1:meta`
- `gh:*` caches
- `rl:assistant:*` limiters
- `assistant:log:<date>`

Without Redis, local dev falls back to `.inventory/inventory.json` (gitignored) and runs
with no limits and no log.

**Testing**:
- **Vitest** (`packages/shared/test`): parsers, alias matching, `buildInventory`
  determinism and invariants, handler routing, the client event mapper, the `run_command`
  allowlist and effect blocking, and tool budgets and outcomes with `MockLanguageModelV3`.
- **Eval suite**: `packages/shared/evals`, with its own config and the real model.
- **Playwright** (`apps/web/e2e`): stubbed `/api/chat` stream.
- **Engine-level SSH parity test**: runs `surface: 'ssh'` against a mocked endpoint.

**Target Platform**:
- Vercel serverless (Node runtime) for `/api/chat`.
- GitHub Actions (ubuntu, Node 20) for the inventory.
- Browser for the web terminal.
- The shared client also runs in Node, for the future SSH host.

**Project Type**: TypeScript monorepo, with a shared engine library (`packages/shared`) and a Next.js web app (`apps/web`).

**Performance Goals**:
- First visible feedback in under 3 s, and the full answer in under 15 s, for 90% of
  questions (SC-007). The thinking indicator is immediate; streaming shows the first
  `data-command` or text as soon as the first tool finishes.
- Inventory rebuild in under 10 minutes for 150 repos (SC-005).

**Constraints**:
- **Per question**: at most 5 tool calls, 6 model steps and 400 output tokens per step.
  Tool results are at most 2,000 characters. Questions are at most 500 characters.
- **Limits**: 15 per visitor per hour, and 1,000 per day across the site
  (`ASSISTANT_DAILY_CAP`).
- **Client bundle**: no server code, zod or octokit. The server code sits behind the
  `@ahmed-moghazy/shared/assistant-server` subpath export.
- The inventory snapshot is at most 900 KB.
- Excluded repos appear nowhere.

**Scale/Scope**:
- About 50–150 repos.
- About 80 seeded alias entries.
- 7 tools.
- 18 golden questions.
- Low hundreds of visitors per day.

No `NEEDS CLARIFICATION` items remain. All were resolved in [research.md](./research.md)
(R1–R19).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Pre-design | Post-design | How |
|---|---|---|---|---|
| I | Single source of truth | ✅ | ✅ | The alias map is new content in `/content/tech-aliases.yaml`, validated by `content:validate`. The prompt's content index is derived from `content`. No portfolio facts are hard-coded; `no-hardcoded-content.test.ts` covers the new files. The inventory is derived data (from GitHub), not authored content |
| II | Render-agnostic core | ✅ | ✅ | The handler, the `ask` effect, the event types, the client, the sanitizer and the sources formatter are in `packages/shared`. The server sends structured `CommandOutput[]`, never ANSI or HTML. Web renders with `OutputRenderer`; SSH will render with Ink. curl is declared as unsupported and falls back to not-found |
| III | Simplicity first | ✅ | ✅ with justification | No new service or datastore: Redis, Vercel and Actions already exist. Three small dependencies (`octokit`, `smol-toml`, `@ai-sdk/google`) are justified below. No vector DB. There is one endpoint for both modes |
| IV | Honest AI | ✅ | ✅ | Citations come only from tool results (R15). "No public evidence found" wording and README-only wording are asserted by evals. `untrusted_text` framing, read-only tools, `decline` for off-topic requests, and injection evals |
| V | Security by default | ✅ | ✅ | The GitHub token and API keys are server- or CI-only. The chat endpoint is rate-limited per visitor, capped daily, and fails closed. The relay IP is honored only with a bearer secret (constant-time compare). Secrets are redacted on ingestion and output. `run_command` is allowlisted and blocks effects. `search_code` input is character-restricted. The stats and log endpoint is token-guarded, and the log stores no IPs |
| VI | Accessibility & motion | ✅ | ✅ | Answers append to the existing `role="log" aria-live="polite"` region. The thinking indicator honors `prefers-reduced-motion`, with no pulse when reduced. Everything is keyboard-only; Ctrl+C cancels |
| VII | Performance budgets | ✅ | ✅ | No new client libraries: the client uses `ai`'s transport, which is already bundled for `useChat`. Nothing is added to the critical path, because the assistant runs only after unknown input |
| VIII | Layered testing | ✅ | ✅ | Vitest unit and wiring tests, Playwright with a stubbed stream, and the golden eval set (≥ 15 questions, all required categories) in CI. SSH smoke is N/A until `apps/ssh` exists; an engine-level parity test stands in for it |
| IX | Independent stories | ✅ | ✅ | **US1** ships the inventory, `lookup_tech`, `list_repos` and `get_repo` into the existing chat mode (testable through `chat`). **US2** adds the handler, `ask`, the client, `run_command` and the web rendering. It works without the inventory, because tools report `unavailable`. **US3** adds live tools, `decline`, limits, the log and evals. The per-visitor limiter that already exists stays in place until US3 replaces it |
| X | Green gate | ✅ | ✅ | `ci.yml` already runs typecheck, test, build and e2e. The new `assistant-eval.yml` is a required check for PRs that touch assistant paths |

**Platform**: Constitution 1.1.0 requires OpenAI as primary with a Gemini fallback for
visitor-facing AI. The plan implements this with `createFallbackModel()` (R16). **Gate:
PASS.**

## Project Structure

### Documentation (this feature)

```text
specs/003-github-aware-assistant/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R19 decisions
├── data-model.md        # Phase 1: inventory, events, limits, log
├── quickstart.md        # Phase 1: per-story verification
├── contracts/
│   ├── chat-api.md          # POST /api/chat, stream parts, relay, stats/log
│   ├── assistant-tools.md   # tool inputs/outputs and budgets
│   ├── shell-integration.md # handler routing, ask effect, askAssistant(), host duties
│   └── inventory-job.md     # workflow, script CLI, pure buildInventory()
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
content/
└── tech-aliases.yaml                      # NEW: owner-editable package → technology map

packages/shared/
├── package.json                           # + octokit, smol-toml; + scripts inventory:build, eval:assistant;
│                                          #   + exports "./assistant-server"
├── scripts/
│   └── build-inventory.ts                 # NEW: CLI (octokit fetch → buildInventory → Redis/file)
├── src/
│   ├── types.ts                           # + CommandResult.ask, CommandDefinition.assistant
│   ├── shell/shell.ts                     # + 'ask' in effectKeys
│   ├── commands/registry.ts               # + assistant: true on allowlisted commands
│   ├── content/                           # + tech-aliases schema/loader, validated with the rest
│   ├── inventory/                         # NEW (server/CI only)
│   │   ├── constants.ts                   # EXCLUDE_TOPIC, manifest patterns, size caps
│   │   ├── types.ts / schema.ts           # InventorySnapshot + zod + checkInvariants()
│   │   ├── manifests.ts                   # per-format parsers
│   │   ├── aliases.ts                     # glob compile + normalize()
│   │   ├── build.ts                       # pure buildInventory()
│   │   ├── lookup.ts                      # lookupTech(), listRepos() over a snapshot
│   │   └── github.ts                      # octokit fetchers (repos, tree, files, languages, readme)
│   └── assistant/
│       ├── types.ts                       # AssistantEvent, NoticeKind, AssistantTurn (client-safe)
│       ├── handler.ts                     # createAssistantUnknownHandler()
│       ├── client.ts                      # askAssistant()
│       ├── sanitize.ts                    # sanitizeAssistantText(), redactSecrets()
│       ├── sources.ts                     # formatSourcesLine()
│       ├── allowlist.ts                   # validateAssistantCommandLine()
│       └── server/                        # exported only via "./assistant-server"
│           ├── prompt.ts                  # buildAssistantPrompt()
│           ├── tools.ts                   # createAssistantTools(deps, budget)
│           ├── fallback.ts                # createFallbackModel(): OpenAI → Gemini before first chunk
│           ├── stream.ts                  # createAssistantStream(): streamText + data parts + sources + outcome
│           └── index.ts
├── test/                                  # NEW tests: inventory-*.test.ts, assistant-*.test.ts
├── evals/assistant/                       # NEW: golden.yaml, fixtures/inventory.json, run.eval.ts
└── vitest.evals.config.ts                 # NEW

apps/web/
├── app/api/chat/route.ts                  # REWRITE: validation → limits → createAssistantStream → log
├── app/api/chat-stats/route.ts            # + ?log=1
├── lib/
│   ├── inventory-store.ts                 # NEW: Redis GET + 5 min memo; file fallback
│   ├── github-live.ts                     # NEW: live tools with Redis caches
│   ├── assistant-limits.ts                # NEW: visitor/global/search limiters, relay identity
│   ├── question-log.ts                    # NEW
│   └── chat-log.ts                        # + 'refused' | 'daily_cap' kinds
├── hooks/useTerminal.ts                   # + ask effect, assistant entry state, session conversation
├── components/
│   ├── AssistantAnswer.tsx                # NEW: renders events/parts
│   ├── ChatRenderer.tsx                   # render parts via AssistantAnswer; surface body
│   └── Terminal.tsx                       # render assistant entries
└── e2e/assistant.spec.ts                  # NEW (stubbed stream)

.github/workflows/
├── inventory.yml                          # NEW: nightly + dispatch
└── assistant-eval.yml                     # NEW: path-filtered PRs + weekly + dispatch

.gitignore                                 # + .inventory/
CLAUDE.md                                  # env vars + architecture notes (during implement)
```

**Structure Decision**: Everything goes into the existing two workspaces. Client-safe
assistant code is exported from the shared package's main entry. Server-only code
(inventory, tools, prompt, streaming) sits behind a new `./assistant-server` subpath, so
the browser bundle never pulls in zod, octokit or prompt text. The web route stays thin,
and the future `apps/ssh` needs only the client-safe exports plus relay headers. The
local inventory file path defaults to `<repo root>/.inventory/inventory.json` and can be
overridden with `INVENTORY_FILE`.

## Implementation notes by story

**Foundational (before US1)**: `createFallbackModel()` with mock-model tests (switch
before the first chunk, no switch after, sticky per question, circuit breaker,
pass-through without a key). The *existing* chat route moves onto it first, so the
fallback ships independently.

**US1 (P1)**:
1. Alias content and schema.
2. Parsers, then the pure `buildInventory()` with snapshot tests.
3. The octokit fetchers and the script.
4. `inventory.yml`.
5. `inventory-store.ts`.
6. `lookup_tech`, `list_repos` and `get_repo` wired into the *existing* route, alongside
   the current prompt.
7. Verify through `chat`.

**US2 (P1)**:
1. The `ask` effect and `assistant` flag.
2. The allowlist validator and its tests.
3. The handler and the routing-table tests.
4. `askAssistant()` and the sanitizer.
5. The `run_command` tool and `data-command` parts.
6. `createAssistantStream()` with budgets and sources.
7. Rewrite the route onto it.
8. `useTerminal` and `AssistantAnswer`, then update `ChatRenderer`.
9. Playwright with a stubbed stream.
10. The SSH parity test.

**US3 (P2)**:
1. `github-live.ts` and the live tools.
2. `decline` and the scope prompt tiers.
3. `untrusted_text` framing and redaction at ingestion.
4. `assistant-limits.ts`, replacing the 15-per-10-minutes limiter, with relay identity
   and fail-closed behavior.
5. `question-log.ts` and the stats `?log=1` option.
6. Golden evals and `assistant-eval.yml`.

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|---|---|---|
| New dependency `octokit` (server/CI only) | The inventory crawls 50–150 repos with pagination and must survive GitHub secondary rate limits. The live tools need the same client | Plain `fetch` would mean hand-writing Link-header pagination, retry and back-off. More code to maintain than one well-known dependency |
| New dependency `smol-toml` (CI only) | `pyproject.toml`, `Pipfile` and `Cargo.toml` are common manifests in Ahmed's Python and ML repos | Regex TOML parsing misses Poetry tables and multi-line arrays, which would silently drop evidence |
| New workflows `inventory.yml` and `assistant-eval.yml` | The nightly and on-demand rebuild (FR-007), and the AI eval gate (Principle VIII) | A Vercel cron hits function time limits and needs a public, authenticated trigger. Folding the evals into `ci.yml` would need the API key on every PR, including forks |
| Fail-closed limiter (a change from the current fail-open) | FR-028 and SC-009 need a guaranteed cost ceiling | Fail-open would leave an unbounded-cost window during Redis incidents |
| New dependency `@ai-sdk/google` and a fallback wrapper | Constitution 1.1.0 requires a Gemini fallback for visitor-facing AI | An AI SDK gateway adds a paid service. Client-side retry would duplicate tool steps and output |
