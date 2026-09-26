# Contract: `GET /api/content`

Consumers: the SSH server (Spec 003), the curl surface if it runs outside Next, and any
external tool. Implements FR-007 and FR-019.

## Request

```http
GET /api/content HTTP/1.1
If-None-Match: "<version>"        # optional
```

No auth. No query parameters (any are ignored).

## Responses

### 200 OK

```http
Content-Type: application/json; charset=utf-8
ETag: "<version>"
Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600
```

```json
{
  "version": "sha256:3f1c…",            // == contentVersion, changes iff content changes
  "generatedAt": "2026-09-26T12:00:00Z",// build time
  "content": { "resume": { … }, "writeups": { "<slug>": { … } }, "cv": { "available": true, "path": "/cv/latest.pdf" } }
}
```

`content` is exactly the normalized `Content` type from [data-model.md](../data-model.md):
all `Text` values are plain strings and there are no `manual` markers.

### 304 Not Modified

When `If-None-Match` equals the current `ETag`. There is no body.

### 429 Too Many Requests

The limit is more than 60 requests per minute per IP. The body is
`{ "error": "rate_limited" }` and the response carries a `Retry-After` header in seconds.
The limit is not enforced when Redis is not configured.

## Guarantees

- The response is the same content that was compiled into the web bundle for that
  deployment, so web and API can never disagree within a deploy.
- Schema changes that remove or rename fields bump `content.schemaVersion`. It starts at
  `1`, is carried inside `content` and is added in this spec. Consumers must reject
  schema versions they don't know and keep their last good snapshot.
- There is no PII beyond what the public site already shows (name, email, phone, links).

## Consumer expectations (for Spec 003)

- Poll at most every 5 minutes, sending `If-None-Match`.
- On a network error, a 5xx or a 429, keep serving the last good snapshot (FR-019).
