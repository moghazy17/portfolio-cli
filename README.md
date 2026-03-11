# Ahmed Moghazy — Portfolio CLI

```
   █████╗ ██╗  ██╗███╗   ███╗███████╗██████╗
  ██╔══██╗██║  ██║████╗ ████║██╔════╝██╔══██╗
  ███████║███████║██╔████╔██║█████╗  ██║  ██║
  ██╔══██║██╔══██║██║╚██╔╝██║██╔══╝  ██║  ██║
  ██║  ██║██║  ██║██║ ╚═╝ ██║███████╗██████╔╝
  ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚═════╝
```

An interactive terminal portfolio for **Ahmed Moghazy**, Data Science & ML Engineer — Cairo, EG.

Available as a **runnable CLI** and a **live web app** built from the same shared codebase.

[![npm version](https://img.shields.io/npm/v/moghazy?color=2c84db&label=npm)](https://www.npmjs.com/package/moghazy)
[![License: MIT](https://img.shields.io/badge/License-MIT-2c84db.svg)](LICENSE)

---

## Live Demo

> **Web:** [moghazy.vercel.app](https://moghazy.vercel.app)

## Run via CLI

```bash
npx moghazy
```

Or install globally:

```bash
npm install -g moghazy
moghazy
```

Requires **Node.js 18+**.

---

## Navigation

The CLI has two modes, switchable with **Tab**:

| Mode | How to use |
|------|-----------|
| **Menu** | Arrow keys `↑ ↓` to highlight, `Enter` to run |
| **Command** | Type a command, press `Enter` |

Press `q` or type `exit` to quit.

---

## Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `help` | `h`, `?` | List all commands |
| `about` | `summary`, `bio` | Professional summary |
| `education` | `edu` | Degree, GPA, coursework |
| `experience [company]` | `exp`, `work` | Work history (filterable) |
| `projects [name]` | `proj` | Technical projects (filterable) |
| `skills [category]` | `sk` | Skills by category |
| `certifications` | `certs`, `awards` | Certifications & achievements |
| `contact` | `email`, `links` | Email, LinkedIn, GitHub |
| `github` | `gh` | Live GitHub profile stats |
| `chat` | `ask`, `ai` | Chat with AI about Ahmed |
| `open [target]` | — | Open GitHub or LinkedIn in browser |
| `timeline` | `tl` | Reverse-chronological career overview |
| `theme [name]` | — | Switch color theme |
| `welcome` | `home`, `banner` | Show the ASCII banner |
| `whoami` | — | Easter egg |
| `clear` | `cls` | Clear the terminal |

**Filter examples:**
```
experience act
projects automl
skills llm
```

---

## AI Chat

Type `chat` (or `ask` / `ai`) to enter AI chat mode. The AI knows about Ahmed's experience, projects, skills, and live GitHub activity. Ask anything — it responds as Ahmed in a terminal-friendly format.

- **Web:** Powered by Google Gemini via Vercel AI SDK
- **CLI:** Streams responses from the web app's `/api/chat` endpoint

---

## Themes

| Theme | Description |
|-------|-------------|
| `matrix` | Dark blue (default) |
| `dracula` | Purple & pink |
| `nord` | Arctic blue-grey |

```
theme dracula
theme nord
theme matrix
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| CLI UI | React 18 + [Ink](https://github.com/vadimdemedes/ink) |
| Web UI | Next.js 15 + React 18 |
| Shared logic | TypeScript (monorepo package) |
| AI Chat | Google Gemini + [Vercel AI SDK](https://sdk.vercel.ai) |
| Caching | [Upstash Redis](https://upstash.com) |
| Bundler (CLI) | tsup (ESM) |
| Monorepo | npm workspaces |

---

## Environment Variables

### Web App (`apps/web/.env.example`)
```
KV_REST_API_URL=         # Upstash Redis URL (optional, for GitHub data caching)
KV_REST_API_TOKEN=       # Upstash Redis token
GOOGLE_GENERATIVE_AI_API_KEY=  # Google AI key (required for chat)
```

### CLI (`apps/cli/.env.example`)
```
PORTFOLIO_API_URL=       # Your deployed web app URL + /api/chat (required for chat)
```

---

## Local Development

```bash
# Install dependencies
npm install

# Start CLI in watch mode
npm run dev:cli

# Start web dev server
npm run dev:web

# Type-check all packages
npm run typecheck

# Production build (all)
npm run build
```

### Updating portfolio content

All CV data lives in one place: [packages/shared/src/data.ts](packages/shared/src/data.ts).
Changes there are reflected in both the CLI and web app automatically.

---

## Project Structure

```
portfolio-cli/
├── apps/
│   ├── cli/          # Ink-based terminal app (published as `moghazy`)
│   └── web/          # Next.js web app (deployed on Vercel)
└── packages/
    └── shared/       # Commands, data, types, themes, GitHub fetch, AI prompt
```

---

## Contact

- **Email:** akhaledmoghazy@gmail.com
- **LinkedIn:** [linkedin.com/in/ahmed-khaled-17s](https://linkedin.com/in/ahmed-khaled-17s)
- **GitHub:** [github.com/moghazy17](https://github.com/moghazy17)
- **Location:** Cairo, EG

---
