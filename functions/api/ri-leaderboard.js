// GET /api/ri-leaderboard — global Random Imperialism feed.
//
//   ?limit=40                 how many rows (1..100, default 40)
//   ?view=recent  (default)   most recent finished sims, newest first
//   ?view=champions           aggregate: nations ranked by how often they've won
//
// Recent rows: { id, champion, turns, top:[...], submitted_at }
// Champions rows: { champion, wins }
// device_id / ip_hash are never returned.

import { json, corsHeaders } from './_lib.js';

const RI_MAX_LIMIT = 100;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  let limit = parseInt(url.searchParams.get('limit') || '40', 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 40;
  if (limit > RI_MAX_LIMIT) limit = RI_MAX_LIMIT;

  const view = url.searchParams.get('view') === 'champions' ? 'champions' : 'recent';

  try {
    if (view === 'champions') {
      const res = await env.DB.prepare(`
        SELECT champion, COUNT(*) AS wins
        FROM ri_runs
        GROUP BY champion
        ORDER BY wins DESC, champion ASC
        LIMIT ?
      `).bind(limit).all();
      return json({ view: 'champions', rows: (res && res.results) || [] });
    }

    const res = await env.DB.prepare(`
      SELECT id, username, champion, turns, top5, submitted_at
      FROM ri_runs
      ORDER BY submitted_at DESC, id DESC
      LIMIT ?
    `).bind(limit).all();

    const rows = ((res && res.results) || []).map(r => {
      let top;
      try { top = JSON.parse(r.top5); } catch (e) { top = [r.champion]; }
      if (!Array.isArray(top) || !top.length) top = [r.champion];
      return {
        id: r.id,
        username: r.username || null,
        champion: r.champion,
        turns: r.turns,
        top,
        submitted_at: r.submitted_at
      };
    });
    return json({ view: 'recent', rows });
  } catch (e) {
    // Table missing (migration not applied yet) or DB hiccup — return empty so
    // the client can fall back to local recaps instead of erroring.
    return json({ view, rows: [], error: 'unavailable' });
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
