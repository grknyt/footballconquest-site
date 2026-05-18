# Leaderboard backend — one-time setup

The global leaderboard API lives in `functions/api/*.js` and deploys
automatically every time Cloudflare Pages builds the site (i.e., every git
push to the connected branch). You only need this guide once, to wire up the
D1 database the API talks to.

## What you need

- Cloudflare account with `footballconquest.com` already on it (Pages site)
- Node.js 18+
- 5 minutes

## Steps

### 1. Push this repo to GitHub

If you haven't already, commit everything in this folder and push to your
`grknyt/footballconquest-site` repo on the `main` branch.

### 2. Connect the repo to Cloudflare Pages

In the Cloudflare dashboard:

- Workers & Pages → Create application → Pages → Connect to Git
- Pick your GitHub repo
- Production branch: `main`
- Build command: *(leave empty)*
- Build output directory: `/`
- Click **Save and Deploy**

The first deploy will build the static site, and Pages will auto-detect the
`functions/` folder. At this point the API routes exist but will fail because
the D1 database isn't bound yet.

### 3. Create the D1 database

From your local clone of the repo:

```bash
npm install -g wrangler
wrangler login
wrangler d1 create fc-leaderboard
```

The CLI prints something like:

```
[[d1_databases]]
binding = "DB"
database_name = "fc-leaderboard"
database_id = "abc123-..."
```

Copy that `database_id` value into the existing root `wrangler.toml`,
replacing the `<PASTE-FROM-wrangler-d1-create-OUTPUT>` placeholder.
Commit + push.

### 4. Apply the schema

```bash
wrangler d1 execute fc-leaderboard --file=./leaderboard/schema.sql --remote
```

Creates the `runs` table and all indexes on the production D1 database.

### 5. Set the IP-salt secret

In the Cloudflare dashboard:

- Pages project → Settings → Environment variables → Production
- Add variable:
  - Variable name: `IP_SALT`
  - Type: **Secret** (encrypted)
  - Value: any random 32+ character string (`openssl rand -hex 32` will do it)

### 6. Trigger a deploy

Either push a commit or click "Retry deployment" on the latest Pages build.
Once it finishes, verify:

```bash
curl https://footballconquest.com/api/health
# → {"ok":true,"ts":"2026-..."}
```

You're live. Finish a campaign in the simulator (Victory or Game Over) with
a display name set, and it'll appear in the Global tab of the Hall of Fame.

## Ongoing deploys

Just `git push`. Cloudflare Pages auto-deploys both the static site and the
Functions API on every push to `main`.

## Validation rules enforced by the API

- Required fields: deviceId, username, heroName, result, wins, losses, gf, ga, turns, territoriesOwned
- `result` ∈ {`victory`, `eliminated`}
- `victory` requires `territoriesOwned === 211`
- `eliminated` requires `losses >= 3` and a non-empty `eliminatedBy`
- `wins + losses <= turns + 1`
- `gf / wins <= 12` (catches absurd goal-to-win ratios)
- `clientDtMs >= 5000` (campaigns can't be claimed faster than 5 seconds)
- Rate limit: max 5 submissions per device per minute, 30 per IP per minute

Rejected submissions return HTTP 400 (or 429 for rate-limit) with
`{error: "...", detail: "..."}`.

## Costs

Cloudflare free tier covers all of this until you're seriously big:

- Pages: unlimited bandwidth, 500 builds/month free
- Pages Functions: 100k invocations/day free
- D1: 5GB storage + 5M reads/day + 100k writes/day free

A leaderboard with ~10k campaigns/day uses well under 1MB. You won't see a
bill for any of this pre-launch.

## Local testing (optional)

```bash
wrangler pages dev .
# Serves the static site + Functions at http://localhost:8788

# To use a local SQLite copy of D1 for testing:
wrangler d1 execute fc-leaderboard --file=./leaderboard/schema.sql --local
wrangler pages dev . --d1 DB=fc-leaderboard
```

Test the endpoints with curl:

```bash
curl -X POST http://localhost:8788/api/submit \
  -H "Content-Type: application/json" \
  --data '{
    "deviceId": "dev-test-001",
    "username": "Tester",
    "heroName": "Brazil",
    "result": "victory",
    "wins": 73, "losses": 8,
    "gf": 254, "ga": 61,
    "turns": 82,
    "territoriesOwned": 211,
    "clientDtMs": 1800000
  }'

curl "http://localhost:8788/api/leaderboard?sort=wins&limit=10"
```

## Schema migrations

Future column or index additions: drop a new SQL file in this folder
(e.g., `2026-06-01-add-foo.sql`), then:

```bash
wrangler d1 execute fc-leaderboard --file=./leaderboard/2026-06-01-add-foo.sql --remote
```

Apply the same migration to local with `--local` instead of `--remote`.
Keep `schema.sql` as the authoritative from-scratch definition by editing
it to match whenever you migrate.
