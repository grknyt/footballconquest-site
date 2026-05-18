// Shared helpers + validation for the Football Conquest leaderboard API.
// Used by the route handlers in this folder (submit.js, leaderboard.js,
// health.js). The leading underscore in the filename tells Cloudflare Pages
// this is NOT a route — just a module other route files import from.

export const ALLOWED_SORTS = new Set(['wins', 'fastest_victory', 'gd', 'gf', 'recent']);
export const MAX_LEADERBOARD_LIMIT = 100;
export const MAX_USERNAME_LEN = 24;
export const MAX_HERO_NAME_LEN = 40;
export const MIN_CAMPAIGN_MS = 5_000;          // claimed-duration floor
export const MAX_TERRITORIES_OWNED = 211;      // 212 nations minus the hero themself
export const MAX_TURNS = 5_000;
export const MAX_GOALS = 9_999;

// Rate limits (counted against device_id, then ip_hash). Pages Functions share
// the same D1 binding so we count submissions via SQL — no Durable Objects.
export const RATE_WINDOW_MS = 60_000;
export const RATE_LIMIT_PER_DEVICE = 5;
export const RATE_LIMIT_PER_IP = 30;

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders()
    }
  });
}

export async function hashHex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function toInt(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : NaN;
}

// Validation: returns {error, detail} on failure, {row: {...}} on success.
export function validateSubmission(body) {
  if (!body || typeof body !== 'object') return { error: 'bad_body' };
  const required = ['deviceId', 'username', 'heroName', 'result',
                    'wins', 'losses', 'gf', 'ga', 'turns', 'territoriesOwned'];
  for (const k of required) {
    if (body[k] === undefined || body[k] === null) return { error: 'missing_field', detail: k };
  }

  const deviceId = String(body.deviceId).trim().slice(0, 100);
  const username = String(body.username).trim().slice(0, MAX_USERNAME_LEN);
  const heroName = String(body.heroName).trim().slice(0, MAX_HERO_NAME_LEN);
  const result   = String(body.result).trim();
  if (!deviceId) return { error: 'bad_device_id' };
  if (!username) return { error: 'bad_username' };
  if (!heroName) return { error: 'bad_hero_name' };
  if (result !== 'victory' && result !== 'eliminated') return { error: 'bad_result' };

  const wins   = toInt(body.wins);
  const losses = toInt(body.losses);
  const gf     = toInt(body.gf);
  const ga     = toInt(body.ga);
  const turns  = toInt(body.turns);
  const tOwned = toInt(body.territoriesOwned);
  const clientDtMs = toInt(body.clientDtMs ?? 0);

  if ([wins, losses, gf, ga, turns, tOwned].some(n => n < 0 || Number.isNaN(n))) {
    return { error: 'bad_numeric_value' };
  }
  if (gf > MAX_GOALS || ga > MAX_GOALS) return { error: 'goals_too_large' };
  if (turns > MAX_TURNS) return { error: 'turns_too_large' };
  if (tOwned > MAX_TERRITORIES_OWNED) return { error: 'territories_too_large' };

// In World Conquest, GAME.turn only increments on WINS (each successful
  // conquest moves the hero forward by one turn). Losses retreat the hero
  // without advancing the turn counter, so the relationship is roughly
  // `turns ≈ wins + 1` regardless of how many losses occurred. A claim of
  // more wins than turns is impossible; losses are unconstrained relative
  // to turns (a player can lose many times in a row before getting eliminated).
  if (wins > turns + 1) return { error: 'turns_mismatch', detail: `${wins}>${turns}+1` };

  if (result === 'victory' && tOwned !== MAX_TERRITORIES_OWNED) {
    return { error: 'victory_without_full_map', detail: `tOwned=${tOwned}` };
  }
  if (result === 'eliminated') {
    if (losses < 3) return { error: 'eliminated_without_3_losses' };
    if (!body.eliminatedBy || typeof body.eliminatedBy !== 'string') {
      return { error: 'missing_eliminated_by' };
    }
  }

  if (clientDtMs > 0 && clientDtMs < MIN_CAMPAIGN_MS) {
    return { error: 'campaign_too_fast', detail: `${clientDtMs}ms` };
  }
  // Sanity: 50-win run averaging +30 goals/match is humanly unreasonable.
  if (wins > 0 && gf / wins > 12) return { error: 'gf_per_win_too_high' };

  const eliminatedBy = result === 'eliminated'
    ? String(body.eliminatedBy).trim().slice(0, MAX_HERO_NAME_LEN) || null
    : null;

  return {
    row: {
      device_id: deviceId, username, hero_name: heroName, result,
      wins, losses, gf, ga, turns, territories_owned: tOwned,
      eliminated_by: eliminatedBy, client_dt_ms: clientDtMs
    }
  };
}
