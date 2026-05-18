// GET /api/leaderboard?sort=wins&limit=50&hero=Brazil&device_id=<id>
//
// Returns a JSON array of run rows sorted by the requested dimension.
// Each row strips device_id unless the caller passed device_id explicitly
// (for "my own global runs" views).
//
// Sort dimensions:
//   wins             — most total wins
//   fastest_victory  — fewest turns among Victories
//   gd               — best goal difference (gf − ga)
//   gf               — most goals scored
//   recent           — most recently submitted

import { json, corsHeaders, ALLOWED_SORTS, MAX_LEADERBOARD_LIMIT, MAX_HERO_NAME_LEN } from './_lib.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const sort = url.searchParams.get('sort') || 'wins';
  if (!ALLOWED_SORTS.has(sort)) return json({ error: 'invalid_sort' }, 400);

  let limit = parseInt(url.searchParams.get('limit') || '50', 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > MAX_LEADERBOARD_LIMIT) limit = MAX_LEADERBOARD_LIMIT;

  const heroFilter = url.searchParams.get('hero');
  const deviceFilter = url.searchParams.get('device_id');

  const orderBy = {
    wins:            'wins DESC, gd DESC, id DESC',
    fastest_victory: 'turns ASC, gd DESC, id DESC',
    gd:              'gd DESC, wins DESC, id DESC',
    gf:              'gf DESC, gd DESC, id DESC',
    recent:          'submitted_at DESC, id DESC'
  }[sort];

  const where = [];
  const params = [];
  if (sort === 'fastest_victory') where.push(`result = 'victory'`);
  if (heroFilter) { where.push(`hero_name = ?`); params.push(heroFilter.slice(0, MAX_HERO_NAME_LEN)); }
  if (deviceFilter) { where.push(`device_id = ?`); params.push(deviceFilter.slice(0, 100)); }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const sql = `
    SELECT id, device_id, username, hero_name, result,
           wins, losses, gf, ga, gd, turns, territories_owned,
           eliminated_by, submitted_at
    FROM runs
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ?
  `;
  params.push(limit);

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  // Strip device_id from public output unless the caller queried for it
  // explicitly (their own global runs).
  const rows = (results || []).map(r => {
    const out = { ...r };
    if (!deviceFilter) delete out.device_id;
    return out;
  });
  return json({ sort, limit, count: rows.length, rows });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
