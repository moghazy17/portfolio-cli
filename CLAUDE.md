# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An interactive portfolio website for Ahmed Moghazy (Data Science & ML Engineer), implemented as a monorepo with a web app and a shared logic package:
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
```

## Architecture

### Monorepo Structure
- `packages/shared/` — Core logic (`@ahmed-moghazy/shared`): command registry, generated content, types, theme, ASCII art, GitHub data fetching, AI prompt builder
- `apps/web/` — Next.js app, deployed on Vercel
- `tsconfig.base.json` — Shared TypeScript base config (strict mode, ES2022, bundler module resolution)

### Command System
Commands live in `packages/shared/src/commands/` as submodules:
- `registry.ts` — `commandRegistry` array of `CommandDefinition` objects
- `engine.ts` — `executeCommand()`, `getCompletions()`, `getMenuItems()`
- `cv.ts` — CV data commands (about, education, experience, projects, skills, certifications, contact)
- `utility.ts` — Utility commands (open, timeline, theme, welcome, whoami)
- `github.ts` — Live GitHub stats command (uses `fetchGitHubData` from `../github`)
- `chat.ts` — AI chat mode entry command
- `easter-eggs.ts` — Hidden fun commands (sudo, rm, neofetch, hello, exit)
- `helpers.ts` — Shared helper functions (e.g., `parseTimelineDate`)

Each `CommandDefinition` has a name, aliases, description, and `execute()` function that returns `CommandResult`. `CommandResult` includes `output: CommandOutput[]`, optional `clear`, `mode`, and `openUrl` fields.

`CommandOutput` is a discriminated union with 7 variants: `text`, `section`, `list`, `table`, `ascii`, `link`, `divider`.

### Shared GitHub Module (`packages/shared/src/github.ts`)
Exports `fetchGitHubData()` → `GitHubStats`, `GITHUB_USERNAME`, `GITHUB_API_BASE`, and shared types (`GitHubUser`, `GitHubRepo`, `GitHubStats`). Used by the shared `github` command (which formats data into `CommandOutput[]`) and the web `github-cache.ts` (which formats a flat string for AI prompt context and caches it with Redis).

### Web App Flow (apps/web/)
- `app/page.tsx` — Next.js page with hidden semantic HTML for SEO
- `components/Terminal.tsx` — Client component; owns command history and theme state
- `components/OutputRenderer.tsx` — DOM-based renderer for the same `CommandOutput` types
- `components/MobileCommands.tsx` — Button shortcuts for mobile (uses `getMenuItems()`)
- `components/ChatRenderer.tsx` — AI chat UI for the web
- `hooks/useTerminal.ts` — Terminal state management (history, theme, mode switching)
- `hooks/useThemeApplier.ts` — Applies theme CSS custom properties
- `lib/github-cache.ts` — Redis-cached GitHub data for AI prompt context
- `app/api/chat/route.ts` — Streaming AI chat endpoint (OpenAI gpt-6-luna via Vercel AI SDK)
- `app/api/content/route.ts` — Versioned portfolio-content API with ETag caching

### Key Patterns
- Portfolio content lives in `content/resume.yaml`, `content/site.yaml`, and optional write-ups at `content/projects/<slug>/README.md`; it is generated into `packages/shared/src/content/generated.ts`
- To update from a CV, add its PDF to `content/cv/incoming/` and review the pull request created by the CV-update workflow
- Theme switching uses CSS custom properties applied to `document.documentElement`
- `DEFAULT_THEME` and `themes` from `packages/shared/src/theme.ts` initialize and update the web terminal theme
- The `openUrl` field on `CommandResult` causes the web terminal to open a URL with `window.open`
- The web app uses `transpilePackages: ['@ahmed-moghazy/shared']` in `next.config.js`
- Redis caching in web app is conditional — works without env vars (graceful degradation)

## Environment Variables

### Web App (`apps/web/`)
| Variable | Required | Description |
|----------|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis REST URL (GitHub cache, chat rate limit, chat stats). Falls back to `KV_REST_API_URL`, the name Vercel's Upstash integration creates |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis REST token. Falls back to `KV_REST_API_TOKEN` |
| `OPENAI_API_KEY` | Yes (for chat) | OpenAI API key |
| `CHAT_STATS_TOKEN` | No | Bearer token for the private `/api/chat-stats` usage report (endpoint returns 404 when unset) |

### GitHub Actions
| Setting | Required | Description |
|----------|----------|-------------|
| `CV_BOT_TOKEN` secret | Yes (CV updates) | Fine-grained token for this repository with Contents and Pull requests read/write permissions |
| `OPENAI_API_KEY` secret | Yes (CV updates and evaluation) | OpenAI API key used for CV extraction |
| `CV_SYNC_MODEL` variable | No | Model for CV synchronization; defaults to `gpt-6-sol` |

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/001-content-pipeline/plan.md` (Spec 001 — Content pipeline)
<!-- SPECKIT END -->
