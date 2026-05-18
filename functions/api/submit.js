// POST /api/submit — record a finished campaign result.
//
// Body: {deviceId, username, heroName, result, wins, losses, gf, ga, turns,
//        territoriesOwned, eliminatedBy?, clientDtMs?}
//
// Validates the submission, hashes the IP, checks rate limits against D1,
// then inserts. Returns {ok:true, submitted_at} on success or
// {error, detail?} with appropriate HTTP status on failure.

import {
  json, corsHeaders, hashHex, validateSubmission,
  RATE_WINDOW_MS, RATE_LIMIT_PER_DEVICE, RATE_LIMIT_PER_IP
} from './_lib.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'bad_json' }, 400); }

  const v = validateSubmission(body);
  if (v.error) return json({ error: v.error, detail: v.detail }, 400);

  // SHA-256 hash the IP with a server-side salt — used for rate-limiting and
  // light abuse detection. We never store or log the raw IP.
  const ip = request.headers.get('CF-Connecting-IP')
          || request.headers.get('x-forwarded-for')
          || '0.0.0.0';
  const ipHash = await hashHex(ip + '|' + (env.IP_SALT || 'default-unsafe-salt'));

  // Per-device and per-IP rate-limiting via a windowed count against the runs
  // table. Cheap because of idx_runs_device + the submitted_at index.
  const sinceIso = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const rate = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM runs WHERE device_id = ? AND submitted_at >= ?) AS by_device,
      (SELECT COUNT(*) FROM runs WHERE ip_hash   = ? AND submitted_at >= ?) AS by_ip
  `).bind(v.row.device_id, sinceIso, ipHash, sinceIso).first();

  if ((rate?.by_device || 0) >= RATE_LIMIT_PER_DEVICE) {
    return json({ error: 'rate_limited', scope: 'device' }, 429);
  }
  if ((rate?.by_ip || 0) >= RATE_LIMIT_PER_IP) {
    return json({ error: 'rate_limited', scope: 'ip' }, 429);
  }

  const submittedAt = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO runs
      (device_id, username, hero_name, result, wins, losses, gf, ga,
       turns, territories_owned, eliminated_by, client_dt_ms, submitted_at, ip_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    v.row.device_id, v.row.username, v.row.hero_name, v.row.result,
    v.row.wins, v.row.losses, v.row.gf, v.row.ga,
    v.row.turns, v.row.territories_owned, v.row.eliminated_by,
    v.row.client_dt_ms, submittedAt, ipHash
  ).run();

  return json({ ok: true, submitted_at: submittedAt });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
