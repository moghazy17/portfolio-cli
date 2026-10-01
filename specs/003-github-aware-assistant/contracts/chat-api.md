# Contract: `POST /api/chat` (assistant endpoint)

This one endpoint serves both in-shell answers and chat mode (FR-021). Implementation:
`apps/web/app/api/chat/route.ts`, a thin wrapper around `createAssistantStream()` from
`@ahmed-moghazy/shared/assistant-server`.

## Request

```http
POST /api/chat
Content-Type: application/json
Origin: https://moghazy.me                      # web; absent for the SSH relay
Authorization: Bearer <ASSISTANT_RELAY_TOKEN>   # SSH relay only
X-Assistant-Client-IP: 203.0.113.7              # SSH relay only; ignored without a valid Authorization
```

```jsonc
{
  "messages": [ /* AI SDK UIMessage[]; last must be role "user" */ ],
  "surface": "web"            // "web" | "ssh"; anything else → 400
}
```

This is the same body shape `useChat` / `DefaultChatTransport` already send. `surface`
travels in the transport's `body` option.

**Server-side normalization**:
- Keep only `text` parts from history.
- Drop tool and data parts from past messages.
- Keep the last 10 non-system messages.

## Processing order

The first failing check ends the request.

| # | Check | Failure response |
|---|---|---|
| 1 | Origin is either absent or in `ALLOWED_ORIGINS` | `403 {"error":"Forbidden"}` |
| 2 | JSON parses; `messages` is a non-empty array; the last message is `user`; `surface` is valid | `400 {"error": "..."}` |
| 3 | The trimmed last user text is 1..500 characters | 200 stream with `data-notice {kind:"too-long"}`. **Not counted** against any limit (FR-031) |
| 4 | Resolve the visitor IP (see §Relay) | — |
| 5 | Per-visitor limit: 15 per hour | 200 stream with `data-notice {kind:"limited", retryAfterSec}`. Logged `limited` |
| 6 | Site-wide daily cap | 200 stream with `data-notice {kind:"daily-cap"}`. Logged `limited` |
| 7 | Redis configured but failing at 5–6 | 200 stream with `data-notice {kind:"unavailable"}`. Fails closed |
| 8 | Run the model with tools (stream) | See §Stream |

Limit and validation outcomes after step 2 are sent as **200 UI-message streams**. That
way `useChat` and `askAssistant()` render them as normal assistant output instead of as
transport errors.

## Stream (`toUIMessageStreamResponse` / `createUIMessageStreamResponse`)

The stream is a standard AI SDK v6 UI message stream, with these **data parts**:

| Part type | Data | When |
|---|---|---|
| `data-command` | `{ id, commandLine, output: CommandOutput[], status }` | Each successful or failed `run_command`, emitted as the tool finishes |
| `data-notice` | `{ kind, message, retryAfterSec? }` | Limit, too-long, unavailable, and `stale` (inventory older than 48 h, emitted once before the text) |
| `data-decline` | `{ category }` | `decline` tool called. Followed by the server's fixed refusal text as a `text` part |
| `data-sources` | `{ commands, evidence: {repo,file}[], repos }` | Once, after the final step, when anything citable was used |

Text parts are the model's summary. Tool-call and tool-result parts for inventory and live
tools are **not** forwarded to the client (`sendReasoning: false`, and tool parts are
filtered out). Only the data parts above are sent.

**Model settings**:

| Setting | Value |
|---|---|
| `model` | `createFallbackModel(openai(ASSISTANT_MODEL), google(ASSISTANT_FALLBACK_MODEL))`: OpenAI first, Gemini if OpenAI fails before its first chunk (research R16) |
| `maxOutputTokens` | 400 |
| `stopWhen` | `[stepCountIs(6), hasToolCall('decline')]` |
| Tool budget | 5 calls excluding `decline`, enforced in `prepareStep` |
| `search_code` | at most 1 call per question |
| `abortSignal` | `req.signal` |

**Refusal text**: these are templates. `{name}` is filled from `profile.firstName` at
runtime (Principle I: no owner name in source).

| Category | Text |
|---|---|
| `off_topic` | "I only answer questions about {name}'s work — try `has he used Kafka?` or type `help`." |
| `personal` | "That's best asked to {name} directly — run `contact` for how to reach him." |
| `instructions` | "I can't share or change my instructions, but I'm happy to answer questions about {name}'s work." |

**Both providers down**: send `data-notice {kind:"unavailable"}`, meaning "The assistant is unavailable right now — commands like `projects` still work." It is logged `error`.

**Errors mid-stream**: a provider or tool failure sends `data-notice {kind:"error"}` with
the message "Something went wrong while answering — try again, or explore with `projects`
and `experience`." Quota exhaustion keeps the existing wording. It is logged `error`.

## Relay (SSH → web), FR-027a

- The SSH server sends `Authorization: Bearer ${ASSISTANT_RELAY_TOKEN}` and
  `X-Assistant-Client-IP: <socket remote address>`, with `surface: "ssh"`.
- The server compares the token in constant time. Only on a match does it use
  `X-Assistant-Client-IP` as the visitor identity, and only if the value parses as an
  IPv4 or IPv6 address.
- Without a valid token, the header is ignored and the request is limited by its own
  address. That is Vercel's `x-real-ip`, falling back to the first `x-forwarded-for` hop.
- If `ASSISTANT_RELAY_TOKEN` is unset, the relay is disabled and every request uses its
  own address.

## Question log side effect

After each request that passed check **3** (valid and not too long), one
`QuestionLogEntry` is written (data-model §7). Too-long requests are neither counted nor
logged.
Writing is best effort: failures are logged to the console and never affect the response.

## `GET /api/chat-stats` (extended)

- The existing report is unchanged.
- New: `?log=1&days=N` (N from 1 to 30) returns
  `{ entries: QuestionLogEntry[] }`, newest first, at most 500 entries.
- Same `Authorization: Bearer <CHAT_STATS_TOKEN>`. Returns 404 when the token is unset or
  wrong.
- **Rate-limited** (Constitution V): `slidingWindow(10, '1 m')` per IP, prefix
  `rl:chat-stats`, checked *before* the token. Over the limit it returns
  `429 {"error":"Too many requests"}`. With Redis unset, there is no limit.
- The daily counters gain `refused` and `daily_cap`.

## Environment

| Variable | Where | Required | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | Vercel | yes | model |
| `ASSISTANT_MODEL` | Vercel | no | primary OpenAI model (default `gpt-6-luna`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Vercel (+ Actions for the weekly fallback eval) | no (fallback disabled if unset) | Gemini fallback |
| `ASSISTANT_FALLBACK_MODEL` | Vercel | with the key | Gemini model id (set: `gemini-3.5-flash-lite`) |
| `ASSISTANT_DAILY_CAP` | Vercel | no | default 1,000 |
| `ASSISTANT_RELAY_TOKEN` | Vercel, Fly | no (until SSH) | trusted relay secret |
| `GH_INVENTORY_TOKEN` | Vercel, Actions | yes for live tools and inventory | fine-grained, read-only, public repos |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` (or `KV_REST_API_*`) | Vercel, Actions | no locally | inventory, limits, caches, log |
