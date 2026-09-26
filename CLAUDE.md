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
```

There are no test commands configured in this project.

## Architecture

### Monorepo Structure
- `packages/shared/` — Core logic (`@ahmed-moghazy/shared`): command registry, CV data, types, theme, ASCII art, GitHub data fetching, AI prompt builder
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
- `app/api/chat/route.ts` — Streaming AI chat endpoint (Google Gemini via Vercel AI SDK)

### Key Patterns
- All CV data is in `packages/shared/src/data.ts` — edit here to update the website
- Theme switching uses CSS custom properties applied to `document.documentElement`
- `DEFAULT_THEME` and `themes` from `packages/shared/src/theme.ts` initialize and update the web terminal theme
- The `openUrl` field on `CommandResult` causes the web terminal to open a URL with `window.open`
- The web app uses `transpilePackages: ['@ahmed-moghazy/shared']` in `next.config.js`
- Redis caching in web app is conditional — works without env vars (graceful degradation)

## Environment Variables

### Web App (`apps/web/`)
| Variable | Required | Description |
|----------|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis REST URL for GitHub data caching |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis REST token |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes (for chat) | Google AI API key for Gemini |
