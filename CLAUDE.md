# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An interactive portfolio website for Ahmed Moghazy (AI Engineer), implemented as a monorepo with a web app and a shared logic package:
- **Web app** — Next.js browser-based terminal emulator with AI chat
- **Shared package** — All command logic, CV data, types, theme definitions, and GitHub data fetching

## Commands

### Development
```bash
npm run dev:web        # Next.js dev server
```

### Build
```bash
npm run build          # Build all workspaces
npm run build:web      # Build web only
```

### Type Checking
```bash
npm run typecheck      # Type-check all workspaces
```

### Other
```bash
npm run clean          # Remove build artifacts across workspaces
npm run content:validate # Validate content files
npm run content:generate # Validate and generate shared content
npm test               # Run workspace tests
npm run test:e2e       # Run Playwright smoke tests
npm run cv:sync -- --pdf <file> [--dry-run] # Merge a CV into resume content
npm run eval:cv        # Evaluate CV extraction fixtures (requires OpenAI API key)
npm run inventory:build -w @ahmed-moghazy/shared -- [--dry-run] [--out <file>]  # Build the GitHub tech inventory (needs GH_INVENTORY_TOKEN)
npm run eval:assistant -w @ahmed-moghazy/shared  # Golden-question assistant evals (requires OpenAI API key)
```

## Architecture

### Monorepo Structure
- `packages/shared/` — Core logic (`@ahmed-moghazy/shared`): command registry, generated content, types, theme, ASCII art, GitHub data fetching, assistant client and server
  - Main entry (`@ahmed-moghazy/shared`) is client-safe; server-only code (zod tools, prompt, stream, model fallback, inventory) is exported only from `@ahmed-moghazy/shared/assistant-server`. `test/assistant-bundle-boundary.test.ts` enforces this
- `apps/web/` — Next.js app, deployed on Vercel
- `tsconfig.base.json` — Shared TypeScript base config (strict mode, ES2022, bundler module resolution)

### Command System
`createShell()` is the shared shell entry point. It exposes `run()`, `complete()`, and
`prompt()`, and keeps session state including the current working directory. Commands live in
`packages/shared/src/commands/` as submodules:
- `registry.ts` — `commandRegistry` array of `CommandDefinition` objects and command metadata
- `engine.ts` — backward-compatible `executeCommand()`, `getCompletions()`, and `getMenuItems()` wrappers, plus `getMenuGroups()` for the full command sheet
- `cv.ts` — CV data commands (about, education, experience, projects, skills, certifications, contact)
- `utility.ts` — Utility commands (open, timeline, theme, welcome, whoami, gui/startx, tour)
- `live.ts` — Live commands over injected `ctx.live`: `who` (presence; `bareOnly`, so `who …` with words goes to the assistant), `guestbook`, `sign` (web only, returns a `sign` effect)
- `github.ts` — Live GitHub stats command (uses `fetchGitHubData` from `../github`)
- `chat.ts` — `chat`/`ask`/`ai` shortcuts: with a question they hand it to the assistant (`ask` effect); bare, they explain that plain questions work at the prompt
- `easter-eggs.ts` — Hidden fun commands (sudo, rm, neofetch, hello, exit, spidey, visca, screensaver); `letterboxd` lives in `live.ts`
- `fs.ts` — Virtual filesystem commands (`ls`, `cd`, `pwd`, `cat`, `tree`) and read-only stubs
- `man.ts` — Manual-page rendering from registry metadata
- `resume.ts` — Resume download/link command
- `helpers.ts` — Shared helper functions (e.g., `parseTimelineDate`)

`src/surface/` holds the access-surface logic shared by the web host and the curl route: `parseAddress()`/`toAddress()` (one address format for browsers and text clients: command paths like `/skills/llm` plus `/?cmd=`), `isTextClient()`, `wantsColor()`, `runTextRequest()`/`curlIndex()` (curl responses and the root guide), `rateLimitedResponse()`, and `recordSurfaceEvent()`/`readSurfaceStats()` (anonymous daily counters over an injected Redis client).

`src/discover/` defines the shared suggestion sets, rotating prompt examples, `promptExamplesFor()` to avoid visible chips, and scripted tour steps. The `tour` command returns a structured effect on web and a web address on curl.

`src/shell/` contains the tokenizer, parser, argument parsing, filters, completion, history,
suggestions, unknown-command handling, and output-to-lines conversion. `src/vfs/` provides
`buildFileSystem()` and path helpers; `src/render/ansi.ts` provides `renderAnsi()`.

Each `CommandDefinition` includes its name, aliases, description, usage, `execute()` function,
and metadata such as `kind`, `menu`, `surfaces`, `args`, `man`, and `hidden`. `CommandResult`
contains `output: CommandOutput[]` plus optional effects: `clear`, `openUrl`, `status`,
`theme`, `welcome`, `download`, `sequence`, `tour`, `screensaver`, `fx` (one-shot web effect: `web` strand or `confetti`), and `ask` (hand unknown input to the AI assistant).
`CommandDefinition.assistant: true` marks the read-only commands the assistant may run. `createShell()` also accepts an
`onUnknownCommand` hook for host-specific handling of unrecognised input.

`CommandOutput` is a discriminated union with 10 variants: `text`, `section`, `list`, `table`,
`ascii`, `link`, `divider`, `error`, `progress`, and `lines`.

### AI Assistant (`packages/shared/src/assistant/`, `src/inventory/`)
- Client-safe (`src/assistant/`): `createAssistantUnknownHandler()` (routes unknown input to an `ask` effect; typos keep "did you mean", piped and curl input never reach the AI), `askAssistant()` (streams `/api/chat` into host-neutral `AssistantEvent`s), `validateAssistantCommandLine()`, `formatSourcesLine()`, `parseAssistantDataPart()`, secret redaction and markdown sanitizing
- Server-only (`src/assistant/server/`): `createAssistantModel()` (OpenAI `ASSISTANT_MODEL`, falls back to Gemini `ASSISTANT_FALLBACK_MODEL` before the first content part), `createAssistantTools()` (`lookup_tech`, `list_repos`, `get_repo`, `run_command`, live tools, `decline`; 5-call budget), `buildAssistantPrompt()`, `createAssistantStream()` (UI-message stream with `data-command`/`data-sources`/`data-notice`/`data-decline` parts), `resolveVisitorIp()`, `classifyOutcome()`/`buildLogEntry()`
- Inventory (`src/inventory/`): pure manifest parsers + `buildInventory()` over all public non-fork repos, skipping the `portfolio-exclude` topic (`src/exclusion.ts`); package→technology map in `content/tech-aliases.yaml`; built nightly by `.github/workflows/inventory.yml` into Redis `inventory:v1`
- Design and contracts: `specs/003-github-aware-assistant/`

### Shared GitHub Module (`packages/shared/src/github.ts`)
Exports `fetchGitHubData()` → `GitHubStats`, `GITHUB_USERNAME`, `GITHUB_API_BASE`, and shared types (`GitHubUser`, `GitHubRepo`, `GitHubStats`). Used by the shared `github` command (which formats data into `CommandOutput[]`). Repos tagged `portfolio-exclude` are dropped.

### Web App Flow (apps/web/)
- `middleware.ts` — Edge middleware: text clients (curl, Wget, HTTPie…) are rewritten to `/api/term`; browsers on command or non-command paths get the terminal page (non-command paths are `noindex`); real page loads of deep links are counted
- `app/page.tsx` — Next.js page with hidden semantic HTML for SEO
- `components/Terminal.tsx` — Client component that composes the terminal chrome, output log, input, and menu
- `components/OutputRenderer.tsx` — DOM-based renderer for the same `CommandOutput` types
- `components/CommandLine.tsx` — Shell input with completion, history, cancellation, and clear-screen keys
- `components/SequencePlayer.tsx` — Skippable command-sequence playback with reduced-motion support
- `components/AssistantAnswer.tsx` — Renders an in-shell assistant answer (command output, text, sources, notices; `aria-busy` while streaming)
- `hooks/useTerminal.ts` — Owns the shell instance, cancellation, command effects (including `ask` → streamed assistant answer and `tour`), and terminal state; `windowed` mode (no boot, address sync or deep-link run; theme applied to the window) serves the /gui terminal window
- `hooks/useTour.ts`, `hooks/useKeyboardInset.ts` — Skippable tour playback and mobile keyboard positioning
- `components/CommandBar.tsx`, `components/CommandSheet.tsx` — The fixed chip bar under both terminals (projects, skills, experience, resume, ✦ ask AI, ⋯ all commands) and the grouped full command list (also lists keyboard shortcuts; `?` on an empty prompt opens it). Groups come from `commands/groups.ts`, shared with `help`
- `hooks/useHistory.ts` — LocalStorage-backed wrapper around the shared history state
- `hooks/useThemeApplier.ts` — Applies theme CSS custom properties and remembers the chosen theme
- `app/gui/` — The regular page (`/gui`), a BeOS-style desktop (see `apps/web/DESIGN.md`): static with hourly revalidation, plain CSS in `gui.css` (+ `cursors.css`); a non-scrolling desk ≥1100px where only the terminal is open at load. Window manager state (minimize, max, cascade, `#hash` links) in `components/desk/DesktopContext.tsx`; windows, Deskbar window list, icons and the terminal window (the real `Terminal`, windowed) in `components/desk/`; mouse click sounds in `hooks/useClickSound.ts`; icons and cursors in `public/desk/`
- `components/Screensaver.tsx`, `components/CrtFilter.tsx`, `hooks/useTypewriter.ts`, `hooks/useIdle.ts`, `hooks/useReducedMotion.ts` — Terminal motion (boot, typewriter for outputs ≤ 40 lines, glitch, CRT, opt-in idle matrix rain via the `screensaver` command); all off under reduced motion
- `lib/view-cookie.ts`, `lib/terminal-snapshot.ts` — Last-used view cookie (middleware sends plain `/` to `/gui`) and the in-tab terminal session shared by `/` and the /gui window in both directions
- `hooks/usePresence.ts`, `lib/presence.ts` — 30 s heartbeats into the `presence:web` sorted set (60 s window)
- `lib/guestbook.ts`, `lib/turnstile.ts`, `lib/turnstile-client.ts` — Guestbook list/sign/delete (`guestbook:v1`, newest 200), Turnstile verification, 1/visitor/day and 200/day limits that fail closed
- `lib/inventory-store.ts` — Reads the tech inventory from Redis (5 min memo), or `.inventory/inventory.json` locally
- `lib/github-live.ts` — Live GitHub reads for the assistant (repos, recent activity, READMEs, code search) with Redis caches
- `lib/assistant-limits.ts` — 15 questions/visitor/hour and a site-wide daily cap; fails closed when Redis errors
- `lib/question-log.ts` — Anonymous 30-day question log (no IPs)
- `app/api/chat/route.ts` — Assistant endpoint for in-shell answers and chat mode (tool-using, OpenAI with Gemini fallback, Vercel AI SDK)
- `app/api/chat-stats/route.ts` — Private usage report and question log (`?log=1`), bearer-token guarded and rate-limited
- `app/api/content/route.ts` — Versioned portfolio-content API with ETag caching
- `app/api/term/route.ts` — Terminal text for text clients (`?nocolor`), rate-limited at 60/min per IP (fails open), counted in the usage report
- `app/api/events/route.ts` — Allow-listed, rate-limited anonymous discoverability counters, including `command_sheet_opens`
- `lib/surface-stats.ts` — Binds the shared surface counters to Redis; `/api/chat-stats` includes them as `surfaces.daily`
- `lib/github-stats.ts` — Cached (10 min, Redis + memory), token-authenticated GitHub stats for the `github` command over curl
- `app/api/presence/route.ts` — Presence heartbeat (POST) and count (GET), 60/min per IP
- `app/api/guestbook/route.ts`, `app/api/guestbook/[id]/route.ts` — Guestbook read/sign and owner deletion (`ADMIN_TOKEN` bearer, 404 when unset)
- `app/api/skills/route.ts` — Per-skill public repo counts from the inventory for the `skills` bars
- `app/api/letterboxd/route.ts`, `lib/letterboxd.ts` — Recent Letterboxd diary entries (public RSS, cached 1 h) for the `letterboxd` command and the /gui Films window
- `app/api/barca/route.ts`, `lib/barca.ts` — Next FC Barcelona fixture from football-data.org (cached 6 h) for the `visca` command; null without `FOOTBALL_DATA_TOKEN`

### Key Patterns
- Portfolio content lives in `content/resume.yaml`, `content/site.yaml`, and optional write-ups at `content/projects/<slug>/README.md`; it is generated into `packages/shared/src/content/generated.ts`
- To update from a CV, add its PDF to `content/cv/incoming/` and review the pull request created by the CV-update workflow
- Theme switching uses CSS custom properties applied to `document.documentElement`
- `DEFAULT_THEME` and `themes` from `packages/shared/src/theme.ts` initialize and update the web terminal theme
- Links run commands on load but never perform `openUrl`/`download`; an `ask` result from a link only prefills the prompt. The address bar follows the last command via `history.replaceState` (questions are never written)
- `useTerminal` applies `CommandResult` effects: `openUrl`, `theme`, `welcome`, `download`, `sequence`, `tour`, `clear`, `screensaver`, and `ask` (streams the assistant answer in place)
- The web app uses `transpilePackages: ['@ahmed-moghazy/shared']` in `next.config.js`
- Redis caching in web app is conditional — works without env vars (graceful degradation)
- For local end-to-end checks, run `npm run build:web`, then `cd apps/web && CI=1 npx playwright test` (set `E2E_PORT` to use a port other than 3100)

## Environment Variables

### Web App (`apps/web/`)
| Variable | Required | Description |
|----------|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis REST URL (GitHub cache, chat rate limit, chat stats). Falls back to `KV_REST_API_URL`, the name Vercel's Upstash integration creates |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis REST token. Falls back to `KV_REST_API_TOKEN` |
| `OPENAI_API_KEY` | Yes (for chat) | OpenAI API key |
| `ASSISTANT_MODEL` | No | Primary OpenAI model (default `gpt-6-luna`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | No | Enables the Gemini fallback |
| `ASSISTANT_FALLBACK_MODEL` | No | Gemini fallback model (default `gemini-3.5-flash-lite`) |
| `GH_INVENTORY_TOKEN` | Yes (for live GitHub tools) | Fine-grained, read-only, public-repos token; also authenticates the cached `github` command over curl |
| `ASSISTANT_DAILY_CAP` | No | Site-wide daily question cap (default 1000) |
| `ASSISTANT_RELAY_TOKEN` | No | Shared secret letting the SSH server relay visitor IPs |
| `INVENTORY_FILE` | No | Local inventory JSON path when Redis is not configured |
| `CHAT_STATS_TOKEN` | No | Bearer token for the private `/api/chat-stats` usage report (endpoint returns 404 when unset) |
| `ADMIN_TOKEN` | No | Bearer token for deleting guestbook entries (endpoint returns 404 when unset) |
| `GUESTBOOK_SALT` | Yes (guestbook, production) | Salt for hashing visitor addresses in the guestbook rate-limit key |
| `TURNSTILE_SECRET_KEY` | Yes (guestbook, production) | Cloudflare Turnstile secret; signing is refused in production without it |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Yes (guestbook) | Cloudflare Turnstile site key (public) |
| `FOOTBALL_DATA_TOKEN` | No | football-data.org API key for the `visca` next-fixture line (falls back to a schedule link) |

### GitHub Actions
| Setting | Required | Description |
|----------|----------|-------------|
| `CV_BOT_TOKEN` secret | Yes (CV updates) | Fine-grained token for this repository with Contents and Pull requests read/write permissions |
| `OPENAI_API_KEY` secret | Yes (CV updates and evaluation) | OpenAI API key used for CV extraction |
| `CV_SYNC_MODEL` variable | No | Model for CV synchronization; defaults to `gpt-6-luna` |
| `GH_INVENTORY_TOKEN` secret | Yes (inventory) | Fine-grained read-only token for the nightly inventory |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` secrets | Yes (inventory) | Redis the inventory job writes to (same database Vercel reads) |
| `GOOGLE_GENERATIVE_AI_API_KEY` secret | No | Weekly Gemini fallback eval |

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/007-unified-command-bar/plan.md` (Spec 007 — unified command bar: one bottom bar with suggestions and an all-commands sheet)
<!-- SPECKIT END -->
