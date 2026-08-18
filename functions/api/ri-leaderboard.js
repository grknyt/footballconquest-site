// GET /api/ri-leaderboard — global Random Imperialism feed.
//
//   ?limit=40                 how many rows (1..100, default 40)
//   ?view=recent  (default)   most recent finished sims, newest first
//   ?view=champions           aggregate: nations ranked by how often they've won
//   ?view=power               aggregate: nations ranked by weighted placement points
//
// Recent rows: { id, champion, turns, top:[...], submitted_at, username }
// Champions rows: { champion, wins }
// Power rows: { champion, points }   (champion = the nation; reuses the field name
//             so the client's flag lookup works for every view)
// device_id / ip_hash are never returned.

import { json, corsHeaders } from './_lib.js';

const RI_MAX_LIMIT = 100;
// Power Ranking weights by finishing position in top5 (1st … 5th).
const RI_POWER_WEIGHTS = [10, 6, 4, 2, 1];
// Cap the scan for the power aggregate so it stays bounded as the table grows.
const RI_POWER_SCAN = 5000;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  let limit = parseInt(url.searchParams.get('limit') || '40', 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 40;
  if (limit > RI_MAX_LIMIT) limit = RI_MAX_LIMIT;

  const rawView = url.searchParams.get('view');
  const view = (rawView === 'champions' || rawView === 'power') ? rawView : 'recent';

  try {
    if (view === 'power') {
      // Weighted placement points across every run. Each run's top5 awards
      // 10/6/4/2/1 for 1st…5th; we sum per nation in JS (JSON arrays don't
      // aggregate cleanly in SQL).
      const res = await env.DB.prepare(`
        SELECT champion, top5 FROM ri_runs
        ORDER BY submitted_at DESC
        LIMIT ?
      `).bind(RI_POWER_SCAN).all();
      const pts = Object.create(null);
      for (const row of ((res && res.results) || [])) {
        let top;
        try { top = JSON.parse(row.top5); } catch (e) { top = [row.champion]; }
        if (!Array.isArray(top) || !top.length) top = [row.champion];
        top.slice(0, RI_POWER_WEIGHTS.length).forEach((nation, i) => {
          if (!nation) return;
          pts[nation] = (pts[nation] || 0) + RI_POWER_WEIGHTS[i];
        });
      }
      const rows = Object.keys(pts)
        .map(nation => ({ champion: nation, points: pts[nation] }))
        .sort((a, b) => b.points - a.points || a.champion.localeCompare(b.champion))
        .slice(0, limit);
      return json({ view: 'power', rows });
    }

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
