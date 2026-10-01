# Ahmed Moghazy — Terminal Portfolio

```
   █████╗ ██╗  ██╗███╗   ███╗███████╗██████╗
  ██╔══██╗██║  ██║████╗ ████║██╔════╝██╔══██╗
  ███████║███████║██╔████╔██║█████╗  ██║  ██║
  ██╔══██║██╔══██║██║╚██╔╝██║██╔══╝  ██║  ██║
  ██║  ██║██║  ██║██║ ╚═╝ ██║███████╗██████╔╝
  ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚═════╝
```

An interactive terminal portfolio for **Ahmed Moghazy**, Data Science & ML Engineer — Cairo, EG.

A browser-based terminal emulator with AI chat, built on a shared command engine.

[![License: MIT](https://img.shields.io/badge/License-MIT-2c84db.svg)](LICENSE)

---

## Live Demo

> **Web:** [moghazy.me](https://moghazy.me)

## Share a view

Every command has a link. Opening it loads the terminal with that command already run, and the address bar follows whatever you run next, so you can copy it to share the current view.

- [moghazy.me/projects](https://moghazy.me/projects) · [moghazy.me/skills](https://moghazy.me/skills) · [moghazy.me/experience](https://moghazy.me/experience)
- Any command line works through `?cmd=`, for example `https://moghazy.me/?cmd=projects%20%7C%20grep%20-i%20rag`.

A link only ever shows something. It never opens other sites or starts downloads, and a question in a link is placed at the prompt for you to send.

## From your terminal

```bash
curl https://moghazy.me                 # guide
curl https://moghazy.me/projects        # any command, as colored text
curl "https://moghazy.me/projects?nocolor"
curl -G https://moghazy.me --data-urlencode "cmd=projects | grep -i rag"
```

Include `https://` (or pass `-L`): plain `http://` requests are redirected to HTTPS.

curl returns content only; questions for the AI assistant need the web terminal. Requests are limited to 60 per minute.

**Coming soon:** `ssh term.moghazy.me` — the full interactive terminal, with nothing to install.

## Try it

- Press `Tab` for completion and `↑`/`↓` to browse history; use `Ctrl+C` to cancel and `Ctrl+L` to clear.
- Pipe output into filters, for example `projects | grep rag`.
- Explore with `ls`, `cd`, `cat`, and `tree`; use `man <command>` for details and `resume` for the PDF.
- There are a few easter eggs waiting to be found.

---

## Navigation

The terminal has two modes, switchable with **Tab**:

| Mode | How to use |
|------|-----------|
| **Menu** | Arrow keys `↑ ↓` to highlight, `Enter` to run |
| **Command** | Type a command, press `Enter` |

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

Powered by OpenAI (gpt-6-luna) via the Vercel AI SDK.

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
| Web UI | Next.js 15 + React 18 |
| Shared logic | TypeScript (monorepo package) |
| AI Chat | OpenAI (gpt-6-luna) + [Vercel AI SDK](https://sdk.vercel.ai) |
| Caching | [Upstash Redis](https://upstash.com) |
| Monorepo | npm workspaces |

---

## Environment Variables

### Web App (`apps/web/.env.example`)
```
UPSTASH_REDIS_REST_URL=   # Upstash Redis REST URL (optional, for GitHub data caching)
UPSTASH_REDIS_REST_TOKEN= # Upstash Redis REST token
OPENAI_API_KEY=            # OpenAI API key (required for chat)
```

---

## Local Development

```bash
# Install dependencies
npm install

# Start web dev server
npm run dev:web

# Type-check all packages
npm run typecheck

# Production build (all)
npm run build
```

### Updating portfolio content

Edit [`content/resume.yaml`](content/resume.yaml) for CV content and
[`content/site.yaml`](content/site.yaml) for site copy. Changes are reflected in the web app, the
`/api/content` endpoint and the AI assistant on the next deploy.

To update from a new CV, drop its PDF into `content/cv/incoming/` and review the
generated pull request. To preserve a bullet from automatic CV synchronization, mark
it as manual:

```yaml
- value: "Engineered a Hierarchical RAG Pipeline in PGVector."
  manual: true
```

---

## Project Structure

```
portfolio-cli/
├── apps/
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
