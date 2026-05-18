# Football Conquest

The static site + leaderboard backend for [footballconquest.com](https://footballconquest.com).

Deployed via Cloudflare Pages. The static site (HTML/CSS/SVG game) and the
serverless leaderboard API (Pages Functions backed by D1) deploy together on
every push to `main`.

## Repo layout

```
.
├── index.html, play.html, simulator.html, ...    ← static site pages
├── css/, assets/                                  ← static assets
├── functions/
│   └── api/
│       ├── _lib.js          ← shared helpers + validation
│       ├── health.js        ← GET /api/health
│       ├── submit.js        ← POST /api/submit
│       └── leaderboard.js   ← GET /api/leaderboard
├── leaderboard/
│   ├── schema.sql           ← D1 schema (apply once via wrangler)
│   └── SETUP.md             ← one-time D1 + Pages setup walkthrough
├── wrangler.toml            ← D1 binding for the Functions
├── ads.txt, robots.txt, sitemap.xml, privacy.html, terms.html
└── README.md
```

## First-time deploy

See [`leaderboard/SETUP.md`](leaderboard/SETUP.md) — a 5-minute Cloudflare
walkthrough (create D1 database, apply schema, set the IP-salt secret).

After that one-time setup, every `git push` to `main` deploys both the
static site and the leaderboard API.

## Local dev

The game itself is a single HTML file — open `simulator.html` in a browser
to play offline. For the leaderboard API:

```bash
npm install -g wrangler
wrangler pages dev .
# http://localhost:8788
```

## Tech stack

- **Frontend**: vanilla HTML/CSS/JS, D3 v7 + topojson-client, single-file
  simulator (~1.9MB with embedded flag PNGs)
- **Backend**: Cloudflare Pages Functions (plain ESM)
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Hosting**: Cloudflare Pages (free tier)
