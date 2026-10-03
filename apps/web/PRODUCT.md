# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Everyone who lands on moghazy.me: recruiters, hiring managers, engineers, and curious visitors who
followed a link. The owner wants the `/gui` page to be personality-led: memorable first, CV second,
with the work woven in rather than buried. The terminal at `/` serves visitors who enjoy exploring by
typing; `/gui` serves those who want to scroll.

## Product Purpose

The personal portfolio of Ahmed Moghazy, Data Science & ML Engineer in Cairo (Software Developer, AI &
Backend at ACT). It shows who he is, what he has built (multi-agent LLM systems, RAG pipelines,
AutoML, data engineering), and gets visitors to reach out, download the CV, or sign the guestbook.
Success: a visitor remembers him an hour later and knows how to contact him.

## Positioning

A portfolio that is itself a working piece of engineering: a real shell with a virtual filesystem,
a tool-using AI assistant grounded in his public GitHub inventory, a curl-able text surface, live
presence and a guestbook. Neither surface is a template; both are built from the same shared content
and command system.

## Operating Context

- Two surfaces from one content source (`content/resume.yaml`, `content/site.yaml`): the terminal at
  `/` and the regular page at `/gui`. A view cookie remembers which one a visitor last used.
- Visitors arrive on desktop and phone; deep links like `/skills` run commands on load.
- Live data: GitHub inventory (skill evidence bars), presence count, guestbook (Turnstile-protected).

## Capabilities and Constraints

- Next.js on Vercel; `/gui` is static with hourly revalidation; plain CSS and Web Animations (no
  animation library) on `/gui`.
- Must keep: all CV content, CV download, contact links, guestbook, presence badge, a clear way back
  to the terminal, light/dark support, reduced-motion support, SEO metadata.
- Personal interests (owner-confirmed): Spider-Man, FC Barcelona, films (Letterboxd `moghazy17`, public
  RSS at https://letterboxd.com/moghazy17/rss/). These appear as hidden easter eggs plus one small
  visible hint on `/gui`, not as a headline section.

## Brand Commitments

- Name: Ahmed Moghazy. Handle: moghazy17 (GitHub, Letterboxd).
- The terminal identity (JetBrains Mono, themeable terminal palettes) is the site's signature; `/gui`
  may take a new visual world but should still feel like the same person.

## Evidence on Hand

- Real CV content, project write-up links, GitHub repos and inventory, Letterboxd diary.
- No photos of the owner, no project screenshots, no testimonials. Do not invent metrics, clients,
  or testimonials beyond what `content/resume.yaml` states.

## Product Principles

1. Personality earns attention; the work keeps it. Every playful element must lead somewhere real.
2. One content source, two surfaces: never fork facts between terminal and page.
3. Reward curiosity: hidden things are discoverable by people who poke around.
4. Fast and accessible on a phone, always.

## Accessibility & Inclusion

WCAG AA contrast, full keyboard use, reduced-motion alternatives for every effect.
