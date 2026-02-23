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

[![npm version](https://img.shields.io/npm/v/ahmed-moghazy?color=2c84db&label=npm)](https://www.npmjs.com/package/ahmed-moghazy)
[![License: MIT](https://img.shields.io/badge/License-MIT-2c84db.svg)](LICENSE)

---

## Live Demo

> **Web:** [ahmed-moghazy.vercel.app](https://moghazy.vercel.app)

## Run via CLI

```bash
npx ahmed-moghazy
```

Or install globally:

```bash
npm install -g ahmed-moghazy
ahmed-moghazy
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
| Shared logic | TypeScript (no runtime deps) |
| Bundler (CLI) | tsup (ESM) |
| Monorepo | npm workspaces |

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
│   ├── cli/          # Ink-based terminal app (published as `ahmed-moghazy`)
│   └── web/          # Next.js web app
└── packages/
    └── shared/       # Commands, data, types, themes, ASCII art
```

---

## Contact

- **Email:** akhaledmoghazy@gmail.com
- **LinkedIn:** [linkedin.com/in/ahmed-khaled-17s](https://linkedin.com/in/ahmed-khaled-17s)
- **GitHub:** [github.com/moghazy17](https://github.com/moghazy17)
- **Location:** Cairo, EG

---

