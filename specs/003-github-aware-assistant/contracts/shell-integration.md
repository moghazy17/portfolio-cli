# Contract: Shell integration (shared engine ↔ hosts)

Everything here lives in `packages/shared`, is exported from the main entry, and is
client-safe: there is no zod, no Redis and no server code.

## `createAssistantUnknownHandler(): UnknownCommandHandler`

The web host passes it as `createShell({ surface: 'web', origin, onUnknownCommand: createAssistantUnknownHandler() })`.
The SSH host will do the same with `surface: 'ssh'`.

The rules are checked in order and the first match wins:

| # | Input | Result |
|---|---|---|
| 1 | `ctx.surface === 'curl'` | `defaultUnknownCommandHandler(input)` |
| 2 | Single word **and** `input.suggestion` present | `defaultUnknownCommandHandler(input)`: "did you mean", no AI (FR-015) |
| 3 | `raw` contains `\|` outside single or double quotes | `defaultUnknownCommandHandler(input)`: unknown input is never piped to the AI |
| 4 | `raw.trim().length > 500` | `{ output: [error "question too long (max 500 characters)"], status: 'error' }` |
| 5 | Otherwise | `{ output: [], ask: { question: raw.trim() } }` |

- Known commands never reach the handler. The engine already routes on the leading word,
  so `projects rag` runs `projects` (edge case).
- `ask` is added to `effectKeys` in `shell.ts`. Nothing else in the parser changes
  (Spec 002 SC-009).

## `askAssistant(options): AsyncIterable<AssistantEvent>`

```ts
interface AskAssistantOptions {
  endpoint: string;                    // web: '/api/chat'; SSH: `${CONTENT_ORIGIN}/api/chat`
  question: string;
  history: AssistantTurn[];            // host keeps ≤ 10 turns (research R17)
  surface: 'web' | 'ssh';
  signal: AbortSignal;                 // Ctrl+C → abort (FR-019)
  headers?: Record<string, string>;    // SSH relay headers
  fetch?: typeof fetch;                // injectable for tests
}
```

- It maps UI-message chunks to `AssistantEvent` (data-model §4). Unknown chunk types are
  ignored.
- Text deltas pass through `sanitizeAssistantText()`, which strips `**`, `__`, leading `#`
  headers and code fences, and through `redactSecrets()` with a carry-over buffer so that
  a secret split across deltas is still caught.
- On abort it stops yielding immediately and doesn't throw to the host.
- Transport or HTTP errors (403/400/5xx) become
  `{ type: 'notice', kind: 'error', message }`, followed by `done`.

## `formatSourcesLine(event): string`

Returns `sources: <cmd> · <cmd> · <repo>/<file> · <repo>`. It is used by every renderer,
so the wording matches on all surfaces.

## Host obligations

| Host | Must |
|---|---|
| Web (`useTerminal`) | On `result.ask`: push a history entry in `thinking` state and iterate `askAssistant()`. Keep the conversation (≤ 5 exchanges) for the session. Cancel on Ctrl+C. Push the question into command history like any input |
| Web (`ChatRenderer`) | Render `useChat` message parts through `AssistantAnswer`. Send `surface: 'web'`. Share the session conversation with the in-shell answers |
| SSH (future `apps/ssh`) | Same as the web `useTerminal` row, using an Ink renderer for events. Send relay headers and `surface: 'ssh'`. Wrap text and command output to the session's current column count, and re-wrap on resize (FR-013). The web wraps with CSS |
| curl | Nothing. The handler falls back to not-found (rule 1) |

## Rendering (all surfaces)

```text
visitor@portfolio:~$ what RAG work has he done?
↳ projects | grep -i rag
rag-pipeline: Stack: Python, LangChain, RAG …
docs-qa: Built a RAG assistant over …
Ahmed has built two RAG systems: • rag-pipeline … • docs-qa …
sources: projects | grep -i rag
```

- The `↳ <commandLine>` header marks output that the assistant ran (FR-017).
- Command output uses the surface's normal `CommandOutput` renderer.
- The sources line is dim.
- Notices use the error or dim style.
