// POST /api/ri-submit — record a finished Random Imperialism sim.
//
// Body: { deviceId, champion, turns, top5:[...], username? }
//
// RI is AI-driven, so this is a shared "who conquered the world" feed, not a
// competitive score. Submitted anonymously (no username opt-in gate — that is
// why the World Conquest board can look empty). Light validation + the same
// per-device / per-IP rate limits as /submit, counted against ri_runs.

import {
  json, corsHeaders, hashHex,
  RATE_WINDOW_MS, RATE_LIMIT_PER_DEVICE, RATE_LIMIT_PER_IP,
  MAX_USERNAME_LEN, MAX_HERO_NAME_LEN, MAX_TURNS
} from './_lib.js';

// A full RI run eliminates ~211 nations, so a plausible finish is well above a
// handful of turns. Loose floor just to reject obviously fabricated tiny runs.
const RI_MIN_TURNS = 50;

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'bad_json' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'bad_body' }, 400);

  const deviceId = String(body.deviceId || '').trim().slice(0, 100);
  const champion = String(body.champion || '').trim().slice(0, MAX_HERO_NAME_LEN);
  const turns    = Math.floor(Number(body.turns));
  const username = body.username ? String(body.username).trim().slice(0, MAX_USERNAME_LEN) : null;

  if (!deviceId) return json({ error: 'bad_device_id' }, 400);
  if (!champion) return json({ error: 'bad_champion' }, 400);
  if (!Number.isFinite(turns) || turns < RI_MIN_TURNS || turns > MAX_TURNS) {
    return json({ error: 'bad_turns', detail: String(body.turns) }, 400);
  }

  // top5: champion first, then up to four runners-up. Coerce to clean strings.
  let top5 = Array.isArray(body.top5) ? body.top5 : [];
  top5 = top5.filter(x => typeof x === 'string')
             .slice(0, 5)
             .map(x => x.trim().slice(0, MAX_HERO_NAME_LEN))
             .filter(Boolean);
  if (!top5.length) top5 = [champion];
  const top5json = JSON.stringify(top5).slice(0, 800);

  const ip = request.headers.get('CF-Connecting-IP')
          || request.headers.get('x-forwarded-for')
          || '0.0.0.0';
  const ipHash = await hashHex(ip + '|' + (env.IP_SALT || 'default-unsafe-salt'));

  const sinceIso = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const rate = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM ri_runs WHERE device_id = ? AND submitted_at >= ?) AS by_device,
      (SELECT COUNT(*) FROM ri_runs WHERE ip_hash   = ? AND submitted_at >= ?) AS by_ip
  `).bind(deviceId, sinceIso, ipHash, sinceIso).first();

  if ((rate?.by_device || 0) >= RATE_LIMIT_PER_DEVICE) return json({ error: 'rate_limited', scope: 'device' }, 429);
  if ((rate?.by_ip     || 0) >= RATE_LIMIT_PER_IP)     return json({ error: 'rate_limited', scope: 'ip' }, 429);

  const submittedAt = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO ri_runs (device_id, username, champion, turns, top5, submitted_at, ip_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(deviceId, username, champion, turns, top5json, submittedAt, ipHash).run();

  return json({ ok: true, submitted_at: submittedAt });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
