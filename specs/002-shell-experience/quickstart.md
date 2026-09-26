# Quickstart: Verifying the Shell Experience

These steps are for a reviewer checking each user story locally. Each story can be
verified on its own branch state.

## Setup

```bash
npm ci
npm run dev:web          # http://localhost:3000
npm test                 # Vitest (shared), includes the legacy-output snapshot
npm run test:e2e         # Playwright (builds + serves the web app)
npm run typecheck
```

## User Story 1: Real shell behavior

Automated: `npm test -- shell-tokenizer shell-parser suggest completion history filters pipes legacy-output`
and `npm run test:e2e -- shell.spec.ts -g "US1"`.

Manual, in the web terminal:

| Type / press | Expect |
|---|---|
| `pro` + Tab | Line becomes `projects ` |
| `t` + Tab + Tab | `theme  timeline  tree` listed (the alias `tl` is grouped under `timeline`), line kept. `tail` is left out because filters are offered only after `\|` |
| `projects ` + first letters of a slug + Tab | Slug completed |
| Run `about`, `skills`, `help`, then Up ×3, Down ×1 | Shows `skills` |
| Type `abc`, Up, Down | `abc` restored |
| Type `foo`, Ctrl+C | `foo^C` echoed, empty prompt |
| Select some output text, Ctrl+C | Text copied; line untouched |
| Ctrl+L with `abc` typed | Screen cleared, `abc` still in the input, Up still works |
| `projects "some name"` | Treated as one argument |
| `skills \| grep -i python` | Only matching lines, each prefixed with its category id |
| `projects \| grep rag` | Matching lines prefixed with the project slug |
| `projects \| head -n 3`, `\| tail -n 2`, `\| wc -l`, `skills \| sort` | As named |
| `experience \| grep -i data \| wc -l` | A single count |
| `projcts` | `command not found: projcts` + ``did you mean `projects`?`` |
| `who are you` | Not-found message with no suggestion, pointing to `help` and `chat` |
| `theme dracula`, `exp`, `certs`, `chat` → `exit`, menu bar buttons | Exactly as before |
| `theme dracula \| wc -l` | Prints a count; the theme does **not** change |

## User Story 2: Browsable filesystem

Automated: `npm test -- vfs vfs-commands item-ids registry-coverage` and
`npm run test:e2e -- shell.spec.ts -g "US2"`.

| Type | Expect |
|---|---|
| `ls` | `certifications/ experience/ projects/ about.md resume.pdf` (folders colored) |
| `cd projects && ls` | Prompt shows `~/projects`; one `<slug>.md` per project |
| `cat <slug>.md` | Project details, then the write-up if `content/projects/<slug>/README.md` exists |
| `cat ~/experience/<Tab>` | Completes a role file; `cat` shows company, title, dates, highlights |
| `pwd` | `/projects` |
| `tree` | Full tree + `3 directories, N files` |
| `cd nowhere`, `cat missing.md`, `cd ~/about.md` | Shell-style errors; `pwd` unchanged |
| `cat ../resume.pdf` | PDF notice pointing to `resume` |
| `cd` | Back to `~` |
| `cat ~/about.md \| grep -i data` | Matching summary lines |
| `mkdir x`, `rm about.md` | Read-only joke; `rm -rf /` still the old easter egg |

Content propagation: add a project to `content/resume.yaml`, run
`npm run content:generate` and reload. `ls ~/projects` now lists it, with no other edits.

## User Story 3: Extras

Automated: `npm test -- man resume sudo-hire-me` and
`npm run test:e2e -- shell.spec.ts -g "US3"`.

| Type | Expect |
|---|---|
| `man projects`, `man ls`, `man grep`, `man man` | Full manual page |
| `man exp` | Page for `experience` |
| `man sudo`, `man nope` | `No manual entry for …` |
| `man` | `What manual page do you want?` hint |
| `resume` | Browser downloads `…-CV.pdf`; confirmation line + link |
| `sudo hire-me` | ≤ 3.5 s animation → contact details + `Send an email` link with the subject and greeting filled in |
| `sudo hire-me` then Ctrl+C immediately | Jumps to the final contact details; prompt usable |
| `sudo hire-me` then type `about` + Enter mid-animation | Animation finishes instantly, `about` runs |
| DevTools → Rendering → `prefers-reduced-motion: reduce`, then `sudo hire-me` | Final output only, no frames |
| `whoami`, `hello`, `neofetch`, `exit` | Unchanged |

Text surfaces (before Spec 003), from a Node REPL or a test:

```ts
const sh = createShell({ surface: 'curl', origin: 'https://example.com' });
renderAnsi((await sh.run('resume')).output, { color: false });
// → "Resume (PDF): https://example.com/cv/latest.pdf\n"
```
