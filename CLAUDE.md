# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An interactive portfolio CLI for Ahmed Moghazy (Data Science & ML Engineer), implemented as a monorepo with two platforms sharing a common logic package:
- **CLI app** — Node.js terminal app using React + Ink
- **Web app** — Next.js browser-based terminal emulator
- **Shared package** — All command logic, CV data, types, and theme definitions

## Commands

### Development
```bash
npm run dev:cli        # CLI in watch mode (tsup)
npm run dev:web        # Next.js dev server
```

### Build
```bash
npm run build          # Build all workspaces
npm run build:cli      # Build CLI only
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
- `packages/shared/` — Core logic (`@ahmed-moghazy/shared`): command registry, CV data, types, theme, ASCII art
- `apps/cli/` — Ink-based terminal UI, published as `ahmed-moghazy` npm package
- `apps/web/` — Next.js app, deployed on Vercel
- `tsconfig.base.json` — Shared TypeScript base config (strict mode, ES2022, bundler module resolution)

### Command System
Commands live in `packages/shared/src/commands.ts` and follow a registry pattern. Each `CommandDefinition` has a name, aliases, description, and `execute()` function that returns `CommandOutput[]`. The CLI and web apps each have their own `OutputRenderer` that renders the same `CommandOutput` types differently.

`CommandOutput` is a discriminated union with 7 variants: `text`, `section`, `list`, `table`, `ascii`, `link`, `divider`.

### CLI App Flow (apps/cli/src/)
- `index.tsx` → `App.tsx` manages two modes via React state
- `MenuMode.tsx` — Arrow-key navigation using Ink's `useInput`
- `CommandMode.tsx` — REPL-style text input
- `OutputRenderer.tsx` — Renders `CommandOutput[]` via Ink components

### Web App Flow (apps/web/)
- `app/page.tsx` — Next.js page with hidden semantic HTML for SEO
- `components/Terminal.tsx` — Client component; owns command history and theme state
- `components/OutputRenderer.tsx` — DOM-based renderer for the same `CommandOutput` types
- `components/MobileCommands.tsx` — Button shortcuts for mobile

### Key Patterns
- All CV data is in `packages/shared/src/data.ts` — edit here to update both platforms simultaneously
- Theme switching uses CSS custom properties applied to `document.documentElement`
- The CLI uses tsup with `noExternal: ['@ahmed-moghazy/shared']` to bundle the shared package inline (no runtime resolution needed)
- The web app uses `transpilePackages: ['@ahmed-moghazy/shared']` in `next.config.js`
