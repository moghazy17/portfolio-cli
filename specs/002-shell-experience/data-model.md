# Data Model: Shell Experience

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Every type lives in `packages/shared/src` and is exported from `@ahmed-moghazy/shared`.
The model has no persistent storage. Content is read-only and comes from the generated
`content` module (Spec 001). The only persisted state is the visitor's command history,
stored in their browser.

---

## Output nodes (`types.ts`)

```ts
type CommandOutput =
  | TextOutput      // existing
  | SectionOutput   // existing + optional `item`
  | ListOutput      // existing
  | TableOutput     // existing
  | AsciiOutput     // existing
  | LinkOutput      // existing
  | DividerOutput   // existing
  | ErrorOutput     // NEW
  | ProgressOutput  // NEW
  | LinesOutput;    // NEW (filtered pipe output)

interface SectionOutput { type: 'section'; title: string; children: CommandOutput[]; item?: string }
interface ErrorOutput    { type: 'error'; content: string }
interface ProgressOutput { type: 'progress'; label: string; value: number }        // 0 ≤ value ≤ 1
interface LinesOutput    { type: 'lines'; lines: Line[]; showItems?: boolean }

interface Line { text: string; style?: OutputStyle; item?: string }
```

**Rules**

- `item` is set only on the per-item sections that `projects`, `experience`,
  `certifications`, `skills` and VFS `cat` emit. Its value is always the `ItemId` of that
  item (see below).
- Commands that exist today MUST keep their exact existing nodes (SC-001). The only
  change to them is the optional `item` field on their sections. Renderers ignore it,
  and the legacy snapshot test strips it before comparing.
- New code reports failures with `error` nodes. The existing
  `{ type: 'text', style: { color: 'error' } }` nodes stay as they are.

## Command registry (`types.ts`, `commands/registry.ts`)

```ts
type Surface = 'web' | 'ssh' | 'curl';

interface CommandDefinition {
  name: string;                 // canonical, lowercase, unique across registry
  aliases: string[];            // lowercase, unique across registry (no multi-word aliases)
  description: string;          // one line, used by `help` and menu
  usage: string;                // kept for `help`; must equal renderSynopsis(args) for new commands
  kind?: 'command' | 'filter';  // default 'command'
  hidden?: boolean;             // easter eggs: excluded from help, menu, completion, suggestions, man
  menu?: boolean;               // shown in menu bar / getMenuItems(); default false
  surfaces?: Surface[];         // default: all three
  args?: ArgSpec;
  man?: ManPage;                // required when !hidden (enforced by test)
  execute: (ctx: CommandContext) => CommandResult | Promise<CommandResult>;
}

interface ArgSpec {
  positional?: Array<{ name: string; required?: boolean; variadic?: boolean; complete?: CompletionSource }>;
  flags?: FlagSpec[];
}
interface FlagSpec { short?: string; long?: string; value?: 'number' | 'string'; description: string }
type CompletionSource =
  | 'projects' | 'experience' | 'skills' | 'themes' | 'open-targets'
  | 'commands' | 'path' | 'dir';

interface ManPage { summary?: string; description: string; examples: string[]; seeAlso?: string[] }
```

**Validation** (enforced by `registry-coverage.test.ts`)

- Names and aliases are unique across the registry, and none contains whitespace. The
  legacy `'rm -rf /'` alias is removed, because `rm`'s argument handling already covers
  it (R2 baseline).
- Every non-hidden entry has `man.description` and at least one example.
- `kind: 'filter'` entries have `surfaces` set to all three, and they can only be used
  after `|`.
- Menu membership keeps today's list exactly: `help`, `about`, `education`,
  `experience`, `projects`, `skills`, `certifications`, `contact`, `timeline`, `github`
  and `chat`. Each of these gets `menu: true`, so `getMenuItems()` returns the same items
  as before (FR-011).

## Execution (`shell/`)

```ts
interface CommandContext {
  args: string[];                               // positional args after flag parsing
  flags: Record<string, string | boolean>;      // keyed by long name, or short when no long
  argv: string[];                               // raw tokens after the command name
  session: ShellSession;
  surface: Surface;
  origin: string;                               // e.g. https://example.com (no trailing slash)
  signal: AbortSignal;
  fs: FileSystem;
}

interface CommandResult {
  output: CommandOutput[];
  status?: 'ok' | 'error';                      // default 'ok'
  clear?: boolean;                              // existing
  mode?: 'chat';                                // existing
  openUrl?: string;                             // existing
  theme?: string;                               // NEW: theme key to apply
  welcome?: boolean;                            // NEW: show welcome screen
  download?: { url: string; filename: string }; // NEW: web-only effect
  sequence?: SequenceStep[];                    // NEW: animation frames before `output`
}

interface SequenceStep { delayMs: number; output: CommandOutput[] }

interface ShellResult extends CommandResult { cancelled?: boolean }
```

**Effect rules**

- A result that feeds a pipe loses `clear`, `mode`, `openUrl`, `theme`, `welcome`,
  `download` and `sequence`. Only `output` (flattened) and `status` pass on.
- In an `a && b` chain, effects are merged left to right, and a later effect wins. Output
  is concatenated. `b` runs only if `a`'s status is `ok`.
- The sum of `delayMs` in a sequence must be 5000 or less. The `sudo hire-me` test
  asserts at most 3500.

### Shell session and state transitions

```ts
interface ShellSession { cwd: VfsPath; lastStatus: 'ok' | 'error' }
```

```
          cd <dir> ok                 cd <bad>
  cwd ───────────────▶ new cwd    cwd ─────────▶ cwd (unchanged), status=error
  run(...) → lastStatus = status of the last executed pipeline
  cancel (signal aborted) → no output, cwd unchanged unless `cd` already completed
```

- A web session starts at `/` when the page loads and is not persisted.
- SSH creates one session per connection. curl creates one per request (Spec 003).

### Unknown-input hook

```ts
interface UnknownInput { raw: string; word: string; suggestion?: string }
type UnknownCommandHandler =
  (input: UnknownInput, ctx: Omit<CommandContext, 'args' | 'flags' | 'argv'>)
    => CommandResult | Promise<CommandResult>;
```

- The hook is called only when the first word of the whole line is not a registered
  name, alias or filter (hidden commands count as registered).
- `suggestion` is set only for single-word input within the FR-012 limits.

## Pipeline (parser output)

```ts
interface Chain    { pipelines: Pipeline[] }          // joined by &&
interface Pipeline { stages: Stage[] }                // joined by |
interface Stage    { name: string; argv: string[]; span: [number, number] }
type ParseError = { kind: 'unterminated-quote' | 'empty-stage' | 'unsupported-operator'
                    | 'filter-not-first' | 'not-a-filter'; message: string; at: number };
```

**Validation**

- Stage 1 of a pipeline must have `kind: 'command'`. A filter there gives
  `grep: expects piped input`.
- Stages 2 and later must be filters. Anything else gives
  `about: cannot receive piped input (try grep, head, tail, wc, sort)`.
- A pipeline has at most 8 stages and a line at most 1,000 characters. Anything beyond
  that is rejected, which bounds the work done per keystroke and per run.

## Item identity (`content/items.ts`)

```ts
type ItemKind = 'project' | 'experience' | 'certification' | 'skill';
interface ItemId { kind: ItemKind; id: string; index: number }   // index = position in content array
function itemIds(content: Content): Record<ItemKind, string[]>;  // parallel to content arrays
```

| Kind | Base id |
|---|---|
| project | `project.slug` (already a validated kebab-case slug) |
| experience | `${work.slug}-${slugify(work.position)}` |
| certification | `slugify(certificate.name)` |
| skill | `slugify(skill.name)` |

- `slugify` does NFKD normalization, strips diacritics, lowercases, turns runs of
  non-`[a-z0-9]` characters into `-`, trims `-`, and cuts the result to 60 characters. If
  the result is empty, it falls back to `<kind>-<index+1>`.
- When two items of the same kind collide, the second gets `-2`, the third `-3`, and so
  on, in content order. The ids are therefore the same on every build for the same
  content.
- One function feeds both the VFS file names and the grep prefixes, so they always match
  (FR-009a).

## Virtual filesystem (`vfs/`)

```ts
type VfsPath = string;  // normalized absolute path, e.g. '/', '/projects', '/projects/x.md'

type VfsNode = VfsDir | VfsFile;
interface VfsDir  { kind: 'dir';  name: string; path: VfsPath; children: VfsNode[] }   // children sorted: dirs first, then name
interface VfsFile { kind: 'file'; name: string; path: VfsPath; size: number;
                    binary?: boolean; render: () => CommandOutput[] }

interface FileSystem {
  root: VfsDir;
  resolve(cwd: VfsPath, input: string): { node?: VfsNode; path: VfsPath; error?: 'ENOENT' | 'ENOTDIR' };
  display(path: VfsPath): string;           // '/' → '~', '/projects' → '~/projects'
}
```

**Tree**

| Path | Source | Content |
|---|---|---|
| `/about.md` | `resume.basics.summary` | same text as `about` |
| `/resume.pdf` | `content.cv` | `binary: true`. Present only when `cv.available` is true |
| `/projects/<id>.md` | `resume.projects[i]` + `writeups[slug]?` | project section, then the write-up body |
| `/experience/<id>.md` | `resume.work[i]` | role section (company, title, dates, highlights) |
| `/certifications/<id>.md` | `resume.certificates[i]` | certificate section |

**Rules**

- The filesystem is read-only. There are no write operations in the model.
- Name lookup is case-insensitive, and the canonical stored names are lowercase.
- `size` is the UTF-8 byte length of `toLines(render())` joined by `\n`. `resume.pdf` has no
  size. `ls -l` shows `pdf` in the size column, so the content schema does not change.
- `resolve` handles `~`, `~/x`, `/`, `.`, `..` (which clamps at the root), repeated
  slashes and trailing slashes. It never throws.

## History (`shell/history.ts`)

```ts
interface HistoryState { entries: string[]; cursor: number | null; draft: string }  // cursor null = editing draft
const HISTORY_LIMIT = 100;
```

| Operation | Effect |
|---|---|
| `push(s, line)` | Ignores blank lines and lines equal to the last entry. Appends, trims to the last 100 entries, and resets the cursor and draft |
| `up(s, current)` | On the first press, saves `current` as the draft. Moves the cursor toward older entries, stopping at the oldest |
| `down(s)` | Moves toward newer entries. Past the newest, it returns the draft and sets the cursor to `null` |

The web persists `entries` in `localStorage['portfolio.history.v1']` as a JSON array.
Unreadable data is ignored.

## Completion (`shell/completion.ts`)

```ts
interface Completion {
  start: number; end: number;        // range in the line to replace
  candidates: string[];              // display strings (folders end with '/')
  replacement?: string;              // unique match (+ trailing space unless dir) or longest common prefix
}
```

## Manual page

This is a derived view with no storage. `renderManPage(def): CommandOutput[]` builds the
sections `NAME`, `SYNOPSIS`, `DESCRIPTION`, `OPTIONS`, `EXAMPLES` and `ALIASES`. Empty
sections are left out.
