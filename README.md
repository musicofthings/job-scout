# Job Scout

Search **public job postings** on the web with [Firecrawl](https://www.firecrawl.dev/) using a **bring-your-own-key (BYOK)** model. Deployed as a **Cloudflare Pages** app with edge Functions that proxy Firecrawl — your API key is never stored server-side.

## Features

- Filters: region/city, country geo, job titles, keywords, role types, work mode, experience, time range
- Source chips for Greenhouse, Lever, Ashby, Workable, Wellfound, RemoteOK, Indeed, LinkedIn public pages, and more
- **Saved searches** (local) with load / run / delete
- **Board fan-out**: optional one Firecrawl query per selected board, then merge + rank
- **Relevance ranking** and post-search filters (text, source, salary, remote, sort)
- **Still active?** — verify postings via scrape heuristics + filter Active / Inactive
- **Daily email digest** — schedule current search (encrypted BYOK key + Resend + cron)
- Light/dark theme toggle (**default light**), Sensa-inspired editorial aesthetic (Averia Serif + Inter, warm paper / deep ink)
- Company logo / OG image on result cards (lazy-loaded)
- Live query preview
- Result cards with open link, optional deep scrape enrich, CSV export
- Key stored only in `localStorage` for interactive search; sent as `X-Firecrawl-Key` per request

## Stack

| Layer | Tech |
|-------|------|
| UI | React + TypeScript + Vite |
| API | Cloudflare Pages Functions (`/api/search`, `/api/scrape`, `/api/active`, `/api/digest/*`) |
| Search | Firecrawl `POST /v2/search` (optional scrape formats) |
| Enrich / active | Firecrawl `POST /v2/scrape` + heuristics |
| Digests | KV + Resend + hourly `POST /api/digest/run` |

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

**Interactive search needs no Cloudflare secrets** (BYOK). Daily digests need the optional bindings below.

## BYOK security model

1. User pastes Firecrawl key → saved in browser `localStorage` only (interactive use).
2. Browser calls `/api/search`, `/api/scrape`, or `/api/active` with header `X-Firecrawl-Key`.
3. Pages Function forwards `Authorization: Bearer <user key>` to Firecrawl.
4. Function response returns normalized jobs; the key is not logged.
5. **Digests (opt-in):** scheduling a digest encrypts the Firecrawl key with `DIGEST_ENCRYPTION_KEY` and stores it in KV solely for cron runs. Unsubscribe deletes the record.

## Still-active checks

1. After a search, click **Check if still active** (or **Is it active?** on a card).
2. Each check scrapes the posting (Firecrawl credits) and classifies **active / inactive / unknown**.
3. Use the **Still active?** filter to show only open roles.

## Daily email digests — exact setup (Resend + Cloudflare KV)

Interactive search works without any of this. Follow these steps only if you want **Schedule daily digest** to send real email in production.

Replace placeholders:

| Placeholder | Example |
|-------------|---------|
| `YOUR_DOMAIN` | `yourdomain.com` (a domain you control) |
| `PAGES_PROJECT` | `job-scout` (Cloudflare Pages project name) |
| `PUBLIC_APP_URL` | `https://job-scout.pages.dev` or your custom domain |
| `ACCOUNT` | your Cloudflare account (Wrangler uses the logged-in one) |

---

### A. Resend (outbound email)

1. **Create an account** at [https://resend.com](https://resend.com) and sign in.
2. **Add and verify a domain** (required for production from-addresses):
   - Resend Dashboard → **Domains** → **Add Domain** → enter `YOUR_DOMAIN`.
   - Add the DNS records Resend shows (SPF, DKIM, and often DMARC) at your DNS provider.
   - Wait until the domain status is **Verified**.
3. **Create an API key**:
   - Resend Dashboard → **API Keys** → **Create API Key**.
   - Permission: **Sending access** is enough.
   - Copy the key once (`re_…`). Store it as `RESEND_API_KEY` (step C).
4. **Choose the From address** (must use the verified domain):
   - Example: `Job Scout <digest@YOUR_DOMAIN>`
   - This exact string becomes `DIGEST_FROM_EMAIL`.
5. **Optional smoke test** from your laptop:

```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "Job Scout <digest@YOUR_DOMAIN>",
    "to": ["you@example.com"],
    "subject": "Resend smoke test",
    "html": "<p>If you got this, Resend works.</p>"
  }'
```

---

### B. Cloudflare KV namespace (`DIGESTS`)

KV stores digest subscriptions (email, filters, encrypted Firecrawl key, unsub token).

1. **Log in to Wrangler** (once per machine):

```bash
cd job-scout
npx wrangler login
```

2. **Create production + preview namespaces**:

```bash
npx wrangler kv namespace create DIGESTS
npx wrangler kv namespace create DIGESTS --preview
```

3. **Copy the IDs** from the CLI output (two 32-char hex strings). Example shape:

```text
{ binding = "DIGESTS", id = "a1b2c3d4e5f6..." }
{ binding = "DIGESTS", preview_id = "f6e5d4c3b2a1..." }
```

4. **Bind KV to the Pages project** (pick **one** of the following).

#### Option B1 — Cloudflare Dashboard (recommended if you deploy via Git)

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → select project **`job-scout`** (or your `PAGES_PROJECT`).
2. **Settings** → **Functions** → **KV namespace bindings** → **Add binding**.
3. Set:
   - **Variable name:** `DIGESTS` (must match exactly — code reads `env.DIGESTS`)
   - **KV namespace:** the `DIGESTS` namespace you created
4. Save. Redeploy the site (or wait for the next Git deploy) so the binding is live.
5. Repeat for **Preview** environment if you use PR preview deploys (bind the preview namespace).

#### Option B2 — `wrangler.toml` (CLI deploys)

Edit `wrangler.toml` and uncomment the KV block with your real IDs:

```toml
[[kv_namespaces]]
binding = "DIGESTS"
id = "PASTE_PRODUCTION_ID_HERE"
preview_id = "PASTE_PREVIEW_ID_HERE"
```

Then deploy:

```bash
npm run deploy
```

---

### C. Environment variables / secrets on Pages

1. Dashboard → **Workers & Pages** → **`job-scout`** → **Settings** → **Environment variables**.
2. Add for **Production** (and Preview if needed):

| Name | Type | Example value | Notes |
|------|------|---------------|--------|
| `RESEND_API_KEY` | Secret | `re_…` | From Resend step A3 |
| `DIGEST_FROM_EMAIL` | Plaintext or Secret | `Job Scout <digest@YOUR_DOMAIN>` | Must match verified domain |
| `DIGEST_ENCRYPTION_KEY` | Secret | long random string (≥16 chars) | Encrypts Firecrawl keys in KV |
| `CRON_SECRET` | Secret | long random string | Auth for digest runner |
| `PUBLIC_APP_URL` | Plaintext | `https://job-scout.pages.dev` | No trailing slash |

Generate secrets locally if you want:

```bash
openssl rand -base64 32   # DIGEST_ENCRYPTION_KEY
openssl rand -base64 32   # CRON_SECRET
```

3. **Save** and **redeploy** Production so Functions pick up the new vars  
   (Dashboard → **Deployments** → **Retry deployment**, or push an empty commit / run `npm run deploy`).

Reference copy of these names lives in `.env.example` (not loaded automatically by Pages — set them in the dashboard or via Wrangler secrets for the project).

---

### D. Hourly cron → `POST /api/digest/run`

The runner only sends digests whose preferred UTC hour matches the current hour, and at most once per UTC day. Call it **hourly**.

**Authorization header (required):**

```http
Authorization: Bearer <CRON_SECRET>
```

#### Option D1 — Free external cron ([cron-job.org](https://cron-job.org) or similar)

1. Create a job with URL: `https://YOUR_PUBLIC_APP_URL/api/digest/run`
2. Method: **POST**
3. Schedule: every hour (`0 * * * *`)
4. Headers:
   - `Authorization: Bearer YOUR_CRON_SECRET`
   - `Content-Type: application/json`
5. Body: `{}`
6. Save and run once manually; expect JSON like `{ "success": true, "processed": N, "results": [...] }`.

#### Option D2 — curl from your machine (manual test)

```bash
export PUBLIC_APP_URL="https://job-scout.pages.dev"
export CRON_SECRET="paste-same-secret-as-pages"

curl -sS -X POST "$PUBLIC_APP_URL/api/digest/run" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Force-send every subscription regardless of hour (debug only):

```bash
curl -sS -X POST "$PUBLIC_APP_URL/api/digest/run" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"force":true}'
```

#### Option D3 — Cloudflare Worker Cron Trigger (optional)

Create a tiny Worker that `fetch`es your Pages URL hourly with the same `Authorization` header. Use if you prefer everything inside Cloudflare.

---

### E. Subscribe from the Job Scout UI

1. Open `PUBLIC_APP_URL` in the browser.
2. Paste and **Save** your Firecrawl API key (BYOK).
3. Set search criteria (titles and/or keywords required).
4. Open **Daily email digest**:
   - Email address
   - Label (optional)
   - Send hour (**local** time)
5. Click **Schedule daily digest**.
6. Save the **unsubscribe token** shown (also stored in this browser’s `localStorage`).
7. Wait for the next matching UTC hour after cron runs, or call the runner with `"force": true` once to test.

**Unsubscribe:** use the panel (email + token), or open the one-click link from a digest email  
(`/api/digest/unsubscribe?email=…&token=…`).

---

### F. Checklist / troubleshooting

| Check | Expected |
|-------|----------|
| Subscribe without KV bound | `503` — “Digest storage is not configured…” |
| Subscribe without encryption secret | `503` — set `DIGEST_ENCRYPTION_KEY` or `CRON_SECRET` (≥16 chars) |
| Cron without `Authorization` | `401 Unauthorized` |
| Cron without Resend vars | Result row `error` about `RESEND_API_KEY` / `DIGEST_FROM_EMAIL` |
| Resend “domain not verified” | Finish DNS in Resend; From must use that domain |
| Email never arrives | Confirm cron is hourly; hour is stored as **UTC** converted from your local hour; spam folder; Resend logs |

**Local `npm run dev`:** digests are stored **in memory only** and **no email is sent**. Use production (or `wrangler pages dev` with KV + vars) for a full test.

## Environment summary

| Variable | Required for | Purpose |
|----------|--------------|---------|
| *(none)* | Interactive search | Fully BYOK |
| `RESEND_API_KEY` | Digests | Send email via Resend |
| `DIGEST_FROM_EMAIL` | Digests | From header |
| `DIGEST_ENCRYPTION_KEY` | Digests | Encrypt Firecrawl keys in KV |
| `CRON_SECRET` | Digests | Protect `/api/digest/run` |
| `PUBLIC_APP_URL` | Digests | Links in email + unsub |
| KV binding `DIGESTS` | Digests | Subscription storage |

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
