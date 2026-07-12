# 📜 Pitchcraft

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**The proposal tool you buy once and own forever.** Build proposals from content blocks, drop in a pricing table with client-toggleable add-ons, send a trackable link, and get a click-to-sign acceptance — all self-hosted, all yours.

Proposify and PandaDoc charge **$19+/month per user, forever**, for what is fundamentally a pricing table with a signature box. Pitchcraft is **$29 once**. Your sales documents are not a subscription.

![Pitchcraft screenshot](docs/screenshot.png)

## ☕ Skip the setup — get the 1-click installer

Don't want to touch a terminal? Grab the packaged Windows installer (and support development):

**→ [Get Pitchcraft on Whop](https://whop.com/benjisaiempire/pitchcraft-app)** — pay once, own it forever.

## Features

- 🧱 **Block-based builder** — cover, text, pricing table, terms, testimonial, and image blocks; drag to reorder
- 📑 **6 starter templates** — web design, marketing retainer, consulting, video production, freelance dev, or blank
- 💰 **Pricing tables with optional add-ons** — mark line items optional and your client toggles them on the live page, watching the total update before they sign
- 🔗 **Trackable share links** — see when a proposal was opened, how many times, and total reading time
- ✍️ **Click-to-sign acceptance** — client types their name, you get a stored acceptance record with signer, timestamp, IP, and the exact total (including which add-ons they chose)
- 💬 **Request-changes flow** — clients comment right on the proposal; status flips to "changes requested"
- 📧 **Email notifications (optional)** — get pinged on first open, acceptance, and comments via your own SMTP
- 🎨 **Branding** — your company name, logo, and accent color on every client page
- 🌑 Premium dark admin UI (React + Tailwind + Framer Motion), clean light-touch client page
- 🔒 **Self-hosted & local-first** — SQLite file you can back up with `cp`; no per-seat pricing ever

## Two ways to run it

**Desktop app** (no server needed):

```bash
npm i
npm run build
npm run desktop
```

Data lives in your OS user-data folder. The window opens auto-logged-in as admin. Note: clients can only open share links if they can reach your machine — for real client-facing use, deploy to a VPS.

**Self-hosted web app** (a $5 VPS is plenty):

```bash
cp .env.example .env   # set ADMIN_PASSWORD!
docker compose up -d   # → http://your-server:5348
```

or without Docker:

```bash
npm i && npm run build && npm start
```

## Quick start (dev)

```bash
npm i
npm run build
npm start        # → http://localhost:5348 (password: admin — change via .env)
npm test         # full HTTP smoke test: templates → edit → send → track → accept
```

## Tech stack

Node 20+ · Express · better-sqlite3 · React 18 · Vite · Tailwind 4 · Framer Motion · Lucide · Electron (desktop mode)

## Pitchcraft vs Proposify / PandaDoc

| | **Pitchcraft** | Proposify | PandaDoc |
|---|---|---|---|
| Price | **$29 once** | $19+/user/mo | $19+/user/mo |
| Yearly cost (3 users) | **$0 after purchase** | $684+ | $684+ |
| Proposal builder + templates | ✅ | ✅ | ✅ |
| Pricing tables w/ optional add-ons | ✅ | ✅ | ✅ (higher tiers) |
| Open & read-time tracking | ✅ | ✅ | ✅ |
| Click-to-sign acceptance | ✅ (simple signature) | ✅ | ✅ |
| Advanced e-signature / notarization | ➖ pair with Inkseal | ✅ | ✅ |
| CRM integrations | ➖ | ✅ | ✅ |
| Your data on your server | ✅ | ❌ | ❌ |
| Works offline / on your LAN | ✅ | ❌ | ❌ |

Honest positioning: if you need enterprise e-signature compliance, CRM sync, and approval workflows, the subscriptions earn their fee. If you need to send professional proposals with pricing, know when they're read, and collect a signed yes — Pitchcraft does that for the price of one month of either.

## License

MIT © 2026 Ben (bensblueprints)

## macOS build

See [MAC-BUILD.md](MAC-BUILD.md). Quickest path: GitHub **Actions** tab -> run the **Mac Build** (`mac-build.yml`) workflow to get a downloadable `.dmg` (unsigned - right-click -> Open on first launch).
