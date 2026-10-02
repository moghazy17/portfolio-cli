# Implementation progress

## Terminal motion

Implemented tasks T032–T055, excluding the Lighthouse check delegated to the orchestrator. T056 remains for the GUI implementation.

Verification from the repository root on 2026-10-02:

- `npm run typecheck`: passed.
- `npm test`: 58 Vitest files, 437 tests passed.
- `npm run build:web`: passed.
- `cd apps/web && CI=1 npx playwright test e2e/motion.spec.ts`: 5 passed, 5 project-specific skips, 0 failed.
- `cd apps/web && CI=1 npx playwright test`: 54 passed, 5 project-specific skips, 0 failed. Chromium: 53 passed; chromium-reduced-motion: 1 passed.

The CRT filter has a WebKit CSS fallback guard. Text sharpness was not checked in WebKit because the configured Playwright projects only include Chromium. The snapshot restoration guard needs to be checked when the separate GUI worktree is merged: restoration should set the initial welcome state to false before the boot effect runs.

## Final verification (orchestrator, 2026-10-02)

- `npm run typecheck`: passed. `npm test`: 62 files, 478 tests passed.
- `npm run build:web`: passed. `CI=1 npx playwright test`: 91 passed, 5 project-specific skips, 0 failed.
- Lighthouse (production build, local):
  - `/gui` mobile: performance 96, accessibility 100 (FCP 1.1 s, LCP 2.7 s)
  - `/gui` desktop: performance 100, accessibility 100 (FCP 0.3 s, LCP 0.6 s)
  - `/` mobile: performance 98, accessibility 96 (FCP 1.1 s, under the 1.5 s first-output budget)
- No secret names or local secret values found in `.next/static`.
- Not run: `npm run eval:assistant` (needs a paid OpenAI key; `who`/`guestbook` are read-only additions to the allow-list, covered by `assistant-allowlist.test.ts`), the manual Upstash checks in quickstart US3, and a WebKit check of CRT text sharpness (a WebKit fallback guard is in place).
