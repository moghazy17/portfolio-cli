# Contract: Shell Engine API (`@ahmed-moghazy/shared`)

This is the public surface that the web uses now and that SSH and curl will use in
Spec 003. Types are defined in [data-model.md](../data-model.md).

## Exports

```ts
// Engine
export function createShell(options: ShellOptions): Shell;
export interface ShellOptions {
  surface: Surface;
  origin: string;                           // absolute origin for links, no trailing slash
  onUnknownCommand?: UnknownCommandHandler; // default: defaultUnknownCommandHandler
  initialCwd?: VfsPath;                     // default '/'
}
export interface Shell {
  run(line: string, opts?: { signal?: AbortSignal }): Promise<ShellResult>;
  complete(line: string, cursor?: number): Completion;   // synchronous, pure w.r.t. session
  prompt(): { user: 'visitor'; host: 'portfolio'; cwd: string };  // cwd display, e.g. '~/projects'
  readonly session: Readonly<ShellSession>;
}
export const defaultUnknownCommandHandler: UnknownCommandHandler;

// Back-compat wrappers (default web shell, origin '')
export function executeCommand(input: string): Promise<CommandResult>;
export function getCompletions(partial: string): string[];   // visible names only (hidden removed)
export function getMenuItems(): Array<{ label: string; value: string }>;  // unchanged output

// Helpers
export function toLines(output: CommandOutput[]): Line[];
export function renderAnsi(output: CommandOutput[], opts?: { color?: boolean; width?: number; theme?: Theme }): string;
export function renderManPage(def: CommandDefinition): CommandOutput[];
export function suggestCommand(word: string): string | undefined;
export const history: { push; up; down; empty: () => HistoryState; HISTORY_LIMIT: 100 };
export function buildFileSystem(content: Content): FileSystem;
export function itemIds(content: Content): Record<ItemKind, string[]>;
export { commandRegistry } from './commands/registry';
```

## `run()` semantics

1. Follows the processing order in [shell-grammar.md](./shell-grammar.md).
2. For each pipeline in a chain:
   - Run stage 1: resolve the command, check `surfaces`, parse flags, then call
     `execute(ctx)`.
     - If the command's `surfaces` excludes the current one, it prints
       `<cmd>: not available on this surface` with status `error`. No command uses this
       yet; it is reserved for Spec 003.
     - If `ArgSpec.flags` is undefined, flag parsing is skipped, apart from `--help`.
       All tokens are passed as `args`. This is how legacy commands keep FR-010.
   - If there are more stages, flatten the output with `toLines`, drop the side effects,
     and pass `Line[]` through each filter. The pipeline output is
     `[{ type: 'lines', lines, showItems }]`.
   - The pipeline status is the status of the last stage. `grep` with no matches gives
     status `error`, like exit code 1. `head`, `tail`, `sort` and `wc` always give `ok`.
3. `&&` stops at the first pipeline with status `error`. Output and effects from the
   pipelines that ran are merged, except that a pipeline with a `clear` or `welcome`
   effect drops the output and `sequence` merged before it, as a screen reset would.
4. **Cancellation.** If `signal.aborted` is true at any `await` boundary, `run` resolves
   `{ output: [], cancelled: true }` and discards any partial output. A `cd` that already
   completed keeps its effect.
5. `run` never throws. An unexpected handler exception becomes
   `[{ type: 'error', content: '<cmd>: something went wrong' }]` with status `error`, and
   the error is logged with `console.error`.

## Surface host responsibilities

| Concern | Web (this spec) | SSH / curl (Spec 003) |
|---|---|---|
| Keys (Tab, Up/Down, Ctrl+C, Ctrl+L) | `CommandLine.tsx` | Ink input handler / N/A |
| `origin` | `window.location.origin` | configured public origin |
| `theme` effect | `useThemeApplier` | session theme / ignored |
| `clear` / Ctrl+L | reset visible history | clear screen / N/A |
| `welcome` effect | show `WelcomeScreen` | print banner |
| `openUrl` | `window.open` | print the link |
| `download` | `<a download>`, falls back to `window.open` | not produced (`resume` returns a link instead) |
| `sequence` | `SequencePlayer`: skippable, reduced motion honored | Ink: play; curl: skip to the final output |
| `mode: 'chat'` | `ChatRenderer` | Ink chat |
| History persistence | `localStorage['portfolio.history.v1']` | per connection, in memory |
| Rendering | `OutputRenderer.tsx` | Ink renderer / `renderAnsi` |

## `toLines` and `renderAnsi`

- `toLines` follows the table in research R8. It is the only definition of an output's
  text form. Pipes, `wc`, VFS sizes and `renderAnsi` all use it.
- `renderAnsi(output, { color: false })` equals
  `toLines(output).map(l => (l.item && showItems ? l.item + ': ' : '') + l.text).join('\n') + '\n'`.
- With `color: true`, it wraps styles in SGR codes using 24-bit color from the theme.
  Links become OSC 8 hyperlinks, with the plain `text: url` form still visible. Every
  styled span ends with a reset.

## Stability guarantees

- Existing `CommandOutput` variants keep their fields. New fields are optional.
- `getMenuItems()` returns exactly the same list as before this feature.
- `executeCommand(name)` for every pre-existing command and alias returns output
  deep-equal to the pre-feature snapshot, ignoring the new optional `item` field (SC-001).
  The exceptions are the documented changes:
  - `help` lists the new commands (FR-014), and its tip line changes.
  - `sudo` hint text now points to `sudo hire-me`.
  - Unknown-command text now suggests a command.
  - `rm <path other than />` now gives the read-only refusal.
  - `--help` on a command now prints usage.
