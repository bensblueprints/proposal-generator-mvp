# Launch strategy — Pitchcraft

## Target communities

- **r/freelance** (no direct self-promo — answer "how do you send proposals?" threads with a genuine workflow write-up; tool mention in context)
- **r/agency** — thread angle: "we cut $684/yr of proposal SaaS, here's the stack" (allowed with mod flair on tool-Tuesday style threads)
- **r/selfhosted** — strongest fit: "self-hosted Proposify alternative, SQLite + Docker, MIT" (show the compose file first, product second — this sub punishes salesy posts)
- **r/webdev + r/web_design** — proposals for client work are a constant pain topic; comment-first strategy
- **Indie Hackers** — build-in-public post with revenue math of subscription vs one-time

## Show HN draft

**Title:** Show HN: Pitchcraft – self-hosted proposal tool with click-to-sign (pay once)

**Body:**
I kept paying proposal SaaS $19/user/month for four features: content blocks, a pricing table, "did they open it," and a signature box. So I built those four features properly and stopped there.

Stack: Node/Express + better-sqlite3 + React/Vite. Single process serves API + frontend. One Docker container, one SQLite file, or run it as an Electron desktop app pointing at the same server code.

Details HN might enjoy:
- Optional line items are client-side toggles — the acceptance record stores exactly which add-ons they chose and the computed total at signing time
- View tracking is a heartbeat, so "read time" is real time on page, not just opens
- The public link is a 22-char base62 token; drafts 404 until you activate
- Postinstall vendors both Node-ABI and Electron-ABI better-sqlite3 bindings so `npm start` and the desktop build share one codebase

MIT source. The $29 is for the packaged Windows installer. Honest limits: no CRM sync, simple typed-name signature (not eIDAS/ESIGN advanced e-sign), you host it.

## SEO keywords (10)

1. proposify alternative
2. pandadoc alternative free
3. proposal software one time purchase
4. self hosted proposal software
5. sales proposal tool no subscription
6. proposal generator with e-signature
7. freelance proposal template software
8. quote builder with optional add-ons
9. proposal tracking software self hosted
10. pandadoc pricing too expensive

## AppSumo / PitchGround pitch

Pitchcraft is the anti-subscription proposal tool: block-based builder, pricing tables with client-toggleable add-ons, trackable share links, and click-to-sign acceptance — self-hosted via Docker or run as a desktop app, with all data in one SQLite file the customer owns. Your audience already hates per-seat SaaS math; Pitchcraft's lifetime price IS the product. MIT-licensed source builds trust; the deal delivers the packaged installer, updates, and priority support.

## Pricing math

- Pitchcraft: **$29 one-time**
- Proposify: $19/user/mo → **pays for itself in under 2 months** (single user)
- PandaDoc Essentials: $19/user/mo → same; a 3-seat team saves **$655 in year one**
- Suggested launch pricing: $19 early-bird first week → $29 standard
