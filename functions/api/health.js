// GET /api/health — liveness probe. Useful for verifying the API is deployed
// and reachable, especially right after the initial Cloudflare setup.
import { json } from './_lib.js';

export function onRequestGet() {
  return json({ ok: true, ts: new Date().toISOString() });
}
