# Quickstart: Living Portfolio

How to run and verify each user story locally. Commands assume the repo root.

## Setup

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # skip if you already have one
```

Optional `apps/web/.env.local` entries for this feature:

```bash
UPSTASH_REDIS_REST_URL=...        # without these, presence/guestbook show "unavailable"
UPSTASH_REDIS_REST_TOKEN=...
ADMIN_TOKEN=dev-admin-token
GUESTBOOK_SALT=dev-salt
# Cloudflare's documented always-pass test keys for local work:
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

Skill bars need an inventory: either Redis `inventory:v1` or a local file
(`npm run inventory:build -w @ahmed-moghazy/shared -- --out .inventory/inventory.json`, needs
`GH_INVENTORY_TOKEN`).

```bash
npm run dev:web
```

## US1 — GUI mode

1. Open `http://localhost:3000` in a fresh profile. The **Regular view** button is visible without
   scrolling (also at 320 px in device mode).
2. Click it → `/gui` with hero, about, experience, projects, skills, guestbook, contact. Download the CV.
3. Click **Terminal** → back to the terminal with the previous log intact.
4. Type `gui`, then `startx` → both open `/gui`.
5. Close the tab, open `http://localhost:3000/` again → lands on `/gui` (remembered view). Open
   `http://localhost:3000/projects` → terminal runs `projects`.
6. Toggle OS/devtools light ↔ dark (`Rendering → prefers-color-scheme`) → page follows.
7. `curl localhost:3000/gui` → one-line pointer to the page.

Lighthouse (record scores in the PR; target ≥ 90 performance and accessibility):

```bash
npm run build:web && (cd apps/web && npx next start -p 3100) &
npx lighthouse http://localhost:3100/gui --preset=desktop --only-categories=performance,accessibility --view
npx lighthouse http://localhost:3100/gui --only-categories=performance,accessibility --view   # mobile
```

## US2 — Terminal motion

1. Fresh profile → boot plays (≤ 3 s). Start typing `about` during it → boot ends and `about` is in
   the input. Reload → no boot.
2. Run `about` → output types out in ≤ 1.5 s; press a key mid-way → completes. Run `cat` on a long
   file → appears instantly.
3. Welcome banner glitches once on load (run `welcome` to see it again).
4. `theme crt` → scanlines, vignette, glow; reload → still `crt`.
5. Leave idle 60 s → matrix rain; type a letter → rain gone, letter in the input. Press Enter during
   rain → only dismisses.
6. `skills` → bars fill with repo counts; `skills | grep -i python` → text bars.
7. DevTools → Rendering → emulate `prefers-reduced-motion: reduce` → none of the above animates.

## US3 — Presence and guestbook

1. Open the terminal in two browsers → `who` shows 2. Close one, wait ~60 s → 1.
2. `guestbook` → entries or the "be the first" line.
3. `sign "Hello from quickstart" --name Tester` → thank-you and the entry. Sign again → "already
   signed today".
4. Try `sign "visit example.com" --name x`, an overlong message, and a blocked word → each refused with
   its message, nothing stored.
5. On `/gui`, the guestbook section shows the same entries.
6. Delete as owner:

   ```bash
   curl -X DELETE -H "Authorization: Bearer dev-admin-token" localhost:3000/api/guestbook/<id>
   ```

7. `curl localhost:3000/who` and `curl localhost:3000/guestbook` → live text; `curl localhost:3000/sign`
   → web-only message.

To reset your own daily limit locally, delete the `rl:guestbook*` keys in the Upstash console.

## Automated checks

```bash
npm run typecheck
npm test                                   # shared unit tests (validation, blocklist, skills, commands)
npm run build:web && cd apps/web && CI=1 npx playwright test   # gui, motion, guestbook, a11y (axe)
```
