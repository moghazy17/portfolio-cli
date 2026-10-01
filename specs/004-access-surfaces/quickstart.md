# Quickstart: Access Surfaces (deep links + curl)

## Run locally

```bash
npm run dev:web            # http://localhost:3000; Redis optional (limits fail open, no counters)
```

## Deep links (US1)

Open these in a browser:

```text
http://localhost:3000/projects                       → welcome, then `projects` output
http://localhost:3000/skills/llm                     → `skills llm`
http://localhost:3000/?cmd=projects%20%7C%20grep%20-i%20rag
http://localhost:3000/?cmd=open%20github             → text only, no new tab
http://localhost:3000/resume                         → text + link, no download
http://localhost:3000/?cmd=what%20RAG%20work%20has%20he%20done%3F → question in the prompt, not sent
```

Then type `skills` and check that the address bar shows `/skills` and that Back doesn't step through every command. Type `clear` and check it shows `/`.

## curl (US2)

```bash
curl localhost:3000                         # guide
curl localhost:3000/projects                # colored
curl "localhost:3000/projects?nocolor"      # plain
curl "localhost:3000/?cmd=projects%20%7C%20grep%20-i%20rag"
curl -i localhost:3000/nonsense             # 404 not-found text
curl -i "localhost:3000/?cmd=what%20is%20his%20stack"   # 404, never reaches the AI
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/projects -A 'Mozilla/5.0'   # 200 HTML
```

## Tests

```bash
npm test                                   # Vitest: address + curl surface
npm run build:web && cd apps/web && CI=1 npx playwright test   # deep links, curl via request.get
```

## Production checks after deploy

First, in the Vercel dashboard, change `moghazy.me` so it serves the site directly instead of redirecting to `www` (research R12). This is a free dashboard change.

```bash
curl https://moghazy.me                    # guide, no redirect
curl https://moghazy.me/projects
curl -sI https://moghazy.me/projects -A 'Mozilla/5.0' | head -1   # 200, HTML
curl -sI http://moghazy.me | head -1       # 308 to https: Vercel always upgrades http, so docs use https://
```

Usage report: `curl -H "Authorization: Bearer $CHAT_STATS_TOKEN" https://moghazy.me/api/chat-stats` shows `surfaces.daily`.
