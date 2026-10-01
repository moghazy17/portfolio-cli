# Contract: Site addresses (shared by browsers and curl)

This module lives in `packages/shared/src/surface/address.ts` and is exported from the main (client-safe) entry. It has no Node or DOM dependencies, so the Edge middleware can use it.

```ts
export const MAX_LINK_LENGTH = 200;
export const routableCommandNames: ReadonlySet<string>;   // visible names + aliases, lower-case

export function parseAddress(pathname: string, search: string,
  names?: ReadonlySet<string>): AddressResult;            // data-model §1
export function toAddress(line: string, names?: ReadonlySet<string>): string;  // data-model §2
export function isTextClient(userAgent: string | null): boolean;
export function wantsColor(search: string): boolean;       // false if nocolor / no_color present
```

## Grammar

```text
address   = "/" [ "?" query ]                       ; root, or root + cmd
          | "/" command *( "/" segment ) [ "?" query ]
command   = visible command name or alias (case-insensitive)
segment   = 1*( unreserved / pct-encoded )          ; one argument each
query     = cmd=<url-encoded command line> and/or nocolor / no_color [= any]
```

- Trailing slashes are ignored (`/projects/` is the same as `/projects`).
- Empty segments are dropped.
- `cmd` is only valid on `/`.
- Filters (`kind: 'filter'`: `grep`, `head`, `tail`, `wc`, `sort`) are not in `routableCommandNames`, so `/grep` is a `not-command` path. Filters are reached through the query form after a pipe (FR-012).
- When `cmd` is repeated, the first value wins.
- `nocolor` and `no_color` are ignored by browsers.

## Text-client detection

`isTextClient` returns true when the user agent matches `^(curl|Wget|HTTPie|xh|aria2|libfetch|Lynx|w3m)\/` (case-insensitive). It returns false for anything else, including an empty or missing user agent, so those clients get HTML.

## Examples (Vitest fixtures)

| Request | Text client | Browser |
|---|---|---|
| `/` | 200 guide | terminal |
| `/projects` | 200 `projects` | terminal and runs `projects`, address unchanged |
| `/Projects/` | 200 `projects` | same as above |
| `/skills/llm` | 200 `skills llm` | runs `skills llm` |
| `/?cmd=projects%20%7C%20grep%20-i%20rag` | 200 pipeline | runs pipeline |
| `/?cmd=what%20RAG%20work%3F` | 404 not-found (never AI) | prompt prefilled, not sent |
| `/?cmd=<201 chars>` | 404 "link too long" | terminal and notice |
| `/projects?cmd=skills` | 404 "ambiguous link" | terminal and notice |
| `/nonsense` | 404 not-found + suggestion | terminal; `nonsense` handled as typed input (no close match → prefilled, not sent); `X-Robots-Tag: noindex` |
| `/projct` | 404 not-found + "did you mean `projects`?" | terminal shows "did you mean"; `noindex` |
| `/sudo/hire-me` | 200 final output (runs as typed input) | terminal runs `sudo hire-me` as typed input; `noindex` (hidden commands are never written in path form) |
| `/?cmd=sudo%20hire-me` | 200 final output | runs sequence; mailto shown as link only |
| `/api/content`, `/cv/latest.pdf`, `/_next/*` | untouched | untouched |
