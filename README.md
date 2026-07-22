# Job Scout

Search **public job postings** on the web with [Firecrawl](https://www.firecrawl.dev/) using a **bring-your-own-key (BYOK)** model. Deployed as a **Cloudflare Pages** app with edge Functions that proxy Firecrawl — your API key is never stored server-side.

## Features

- Filters: region/city, country geo, job titles, keywords, role types, work mode, experience, time range
- Source chips for Greenhouse, Lever, Ashby, Workable, Wellfound, RemoteOK, Indeed, LinkedIn public pages, and more
- **Saved searches** (local) with load / run / delete
- **Board fan-out**: optional one Firecrawl query per selected board, then merge + rank
- **Relevance ranking** and post-search filters (text, source, salary, remote, sort)
- **Still active?** — verify postings via scrape heuristics + filter Active / Inactive
- Light/dark theme toggle (**default light**), Sensa-inspired editorial aesthetic (Averia Serif + Inter, warm paper / deep ink)
- Clear cache & history (browser)
- Company logo / OG image on result cards (lazy-loaded)
- Live query preview
- Result cards with open link, optional deep scrape enrich, CSV export
- Key stored only in `localStorage` for interactive search; sent as `X-Firecrawl-Key` per request

## Stack

| Layer | Tech |
|-------|------|
| UI | React + TypeScript + Vite |
| API | Cloudflare Pages Functions (`/api/search`, `/api/scrape`, `/api/active`) |
| Search | Firecrawl `POST /v2/search` (optional scrape formats) |
| Enrich / active | Firecrawl `POST /v2/scrape` + heuristics |

## Local development

```bash
cd job-scout
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Paste a Firecrawl key and search.

Local `/api/*` is handled by a Vite middleware that mirrors the Pages Functions (no Wrangler required for day-to-day UI work).

### Preview with real Pages Functions

```bash
npm run build
npm run pages:dev
```

## Deploy to Cloudflare Pages

### CLI

```bash
npm run build
npx wrangler pages deploy dist --project-name=job-scout
```

Or:

```bash
npm run deploy
```

### Git-connected project

1. Push this repo to GitHub/GitLab.
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → connect repo.
3. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** project root
4. Pages auto-detects `functions/` for `/api/*`.

**Live site:** [https://job-scout-9u8.pages.dev](https://job-scout-9u8.pages.dev)

**Interactive search needs no Cloudflare secrets** (BYOK).

## BYOK security model

1. User pastes Firecrawl key → saved in browser `localStorage` only.
2. Browser calls `/api/search`, `/api/scrape`, or `/api/active` with header `X-Firecrawl-Key`.
3. Pages Function forwards `Authorization: Bearer <user key>` to Firecrawl.
4. Function response returns normalized jobs; the key is not logged or stored server-side.

## Still-active checks

1. After a search, click **Check if still active** (or **Is it active?** on a card).
2. Each check scrapes the posting (Firecrawl credits) and classifies **active / inactive / unknown**.
3. Use the **Still active?** filter to show only open roles.

## Daily digests — deferred

Scheduled email digests (Gmail / Resend / cron) are **paused for now**. Third-party mailbox OAuth and domain verification were too heavy for this project phase.

What still works well without digests:

- Interactive BYOK search on [https://job-scout-9u8.pages.dev](https://job-scout-9u8.pages.dev)
- Saved searches (browser)
- Board fan-out, ranking, filters
- **Still active?** checks
- CSV export
- Clear cache & history

**Possible later (no Gmail/Resend):** Discord / Slack / generic webhook digests (POST JSON to a URL you control), or browser-side reminders only. Backend stubs under `functions/api/digest/` may be reused; the UI no longer exposes email scheduling.

## Environment summary

| Variable | Purpose |
|----------|---------|
| *(none)* | Interactive BYOK search works fully without secrets |

## Scripts


| Script | Description |
|--------|-------------|
| `npm run dev` | Vite + local API middleware |
| `npm run build` | Typecheck + production bundle to `dist/` |
| `npm run pages:dev` | `wrangler pages dev dist` with Functions |
| `npm run deploy` | Build + deploy to Cloudflare Pages |

## Notes

- This app searches the **open web** and public ATS boards via Firecrawl. It does **not** use unofficial LinkedIn session scrapers or third-party LinkedIn MCP servers.
- Respect site terms of use and Firecrawl’s acceptable use policy.
- Deep scrape / enrich uses more Firecrawl credits than title/snippet search.
