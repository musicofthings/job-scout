# Job Scout

Search **public job postings** on the web with [Firecrawl](https://www.firecrawl.dev/) using a **bring-your-own-key (BYOK)** model. Deployed as a **Cloudflare Pages** app with edge Functions that proxy Firecrawl — your API key is never stored server-side.

## Features

- Filters: region/city, country geo, job titles, keywords, role types, work mode, experience, time range
- Source chips for Greenhouse, Lever, Ashby, Workable, Wellfound, RemoteOK, Indeed, LinkedIn public pages, and more
- Live query preview
- Result cards with open link, optional deep scrape enrich, CSV export
- Key stored only in `localStorage`; sent as `X-Firecrawl-Key` per request

## Stack

| Layer | Tech |
|-------|------|
| UI | React + TypeScript + Vite |
| API | Cloudflare Pages Functions (`/api/search`, `/api/scrape`) |
| Search | Firecrawl `POST /v2/search` (optional scrape formats) |
| Enrich | Firecrawl `POST /v2/scrape` + JSON extraction |

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

**No Cloudflare secrets are required.** Users bring their own Firecrawl keys in the UI.

## BYOK security model

1. User pastes Firecrawl key → saved in browser `localStorage` only.
2. Browser calls `/api/search` or `/api/scrape` with header `X-Firecrawl-Key`.
3. Pages Function forwards `Authorization: Bearer <user key>` to Firecrawl.
4. Function response returns normalized jobs; the key is not logged or persisted.

## Environment

None required for production. Optional local tooling:

| Variable | Purpose |
|----------|---------|
| (none) | App is fully BYOK |

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
