// /api/bugs — Football Conquest bug-report receiver.
//
// Accepts a multipart/form-data POST from /report-bug.html, builds an email
// with the (optional) screenshot attached, and sends it via the Resend HTTP
// API. Free tier on Resend is 3,000 emails/month, well above what a single
// site will produce, and they support attachments natively so we don't have
// to MIME-encode anything ourselves.
//
// Required environment variables (set in Cloudflare Pages → Settings →
// Environment variables):
//   RESEND_API_KEY   - API key from https://resend.com/api-keys
//   BUG_TO           - destination address (e.g. footballconquestbugs@gmail.com)
//   BUG_FROM         - sender address. Either a verified domain address
//                      (bugs@footballconquest.com) or Resend's onboarding
//                      domain (onboarding@resend.dev) for initial testing.

import { corsHeaders, json } from './_lib.js';

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

export async function onRequestPost({ request, env }) {
  if (!env.RESEND_API_KEY) {
    return json({ success: false, message: 'Server is not configured (missing RESEND_API_KEY)' }, 500);
  }

  let form;
  try {
    form = await request.formData();
  } catch (err) {
    return json({ success: false, message: 'Could not parse form: ' + err.message }, 400);
  }

  const description  = String(form.get('description') || '').trim();
  const steps        = String(form.get('steps_to_reproduce') || '').trim();
  const reporterName = String(form.get('reporter_name') || '').trim().slice(0, 80);
  const replyEmail   = String(form.get('reply_email') || '').trim();
  const browser      = String(form.get('browser_user_agent') || '').trim();
  const viewport    = String(form.get('viewport_size') || '').trim();
  const language    = String(form.get('page_language') || '').trim();
  const pageUrl     = String(form.get('page_url') || '').trim();
  const gameContext = String(form.get('game_context') || '').trim();
  const screenshot  = form.get('screenshot');

  if (!description) {
    return json({ success: false, message: 'Description is required' }, 400);
  }

  // ── Build email bodies (plain text + HTML) ────────────────────────
  const subject = '[BUG] ' + description.slice(0, 64).replace(/\s+/g, ' ') + (description.length > 64 ? '…' : '');

  const textLines = [
    'New bug report from Football Conquest',
    '',
    `Reporter: ${reporterName || '(anonymous)'}`,
    `Reply email: ${replyEmail || '(not provided)'}`,
    '',
    'Description:',
    description,
    '',
    'Steps to reproduce:',
    steps || '(none provided)',
    '',
    '──────── Auto-captured context ────────',
    `Browser:    ${browser}`,
    `Viewport:   ${viewport}`,
    `Language:   ${language}`,
    `Page URL:   ${pageUrl}`,
    `Game state: ${gameContext || '(none)'}`,
  ];
  const text = textLines.join('\n');

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:640px;color:#222;">
    <h2 style="margin:0 0 12px;color:#c8102e;letter-spacing:1px;">⚽ Football Conquest Bug Report</h2>

    <h3 style="margin:18px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#666;">Reporter</h3>
    <p style="margin:0;">${escapeHtml(reporterName) || '<em style="color:#999;">(anonymous)</em>'}${replyEmail ? ` &middot; <a href="mailto:${escapeHtml(replyEmail)}">${escapeHtml(replyEmail)}</a>` : ''}</p>

    <h3 style="margin:18px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#666;">Description</h3>
    <p style="white-space:pre-wrap;margin:0;line-height:1.5;">${escapeHtml(description)}</p>

    <h3 style="margin:18px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#666;">Steps to reproduce</h3>
    <p style="white-space:pre-wrap;margin:0;line-height:1.5;">${escapeHtml(steps) || '<em style="color:#999;">(none provided)</em>'}</p>

    <hr style="margin:24px 0;border:0;border-top:1px solid #eaeaea;">

    <h3 style="margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#666;">Auto-captured context</h3>
    <table style="font-size:13px;border-collapse:collapse;width:100%;">
      <tr><td style="padding:4px 12px 4px 0;color:#888;vertical-align:top;width:120px;">Browser</td><td style="padding:4px 0;font-family:monospace;font-size:11px;word-break:break-all;">${escapeHtml(browser)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#888;">Viewport</td><td style="padding:4px 0;">${escapeHtml(viewport)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#888;">Language</td><td style="padding:4px 0;">${escapeHtml(language)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#888;">Page URL</td><td style="padding:4px 0;"><a href="${escapeHtml(pageUrl)}">${escapeHtml(pageUrl)}</a></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#888;vertical-align:top;">Game state</td><td style="padding:4px 0;font-family:monospace;font-size:11px;">${escapeHtml(gameContext) || '<em style="color:#999;">(none)</em>'}</td></tr>
    </table>
  </div>`;

  // ── Attachments ────────────────────────────────────────────────────
  // Resend expects each attachment as { filename, content } where content is
  // base64-encoded. We read the uploaded File as an ArrayBuffer and convert.
  const attachments = [];
  if (screenshot && typeof screenshot === 'object' && screenshot.size > 0) {
    // Cap at ~9 MB raw (Resend accepts 40 MB total but JSON-encoded base64 grows ~33%)
    const MAX_BYTES = 9 * 1024 * 1024;
    if (screenshot.size > MAX_BYTES) {
      return json({ success: false, message: 'Screenshot is too large (max ~9 MB). Try compressing or cropping.' }, 413);
    }
    const buf = await screenshot.arrayBuffer();
    attachments.push({
      filename: (screenshot.name && String(screenshot.name)) || 'screenshot.png',
      content: arrayBufferToBase64(buf)
    });
  }

  // ── Send via Resend ────────────────────────────────────────────────
  const payload = {
    from: env.BUG_FROM || 'Football Conquest <onboarding@resend.dev>',
    to: [env.BUG_TO || 'footballconquestbugs@gmail.com'],
    subject,
    text,
    html,
    ...(replyEmail ? { reply_to: replyEmail } : {}),
    ...(attachments.length ? { attachments } : {})
  };

  let resendRes;
  try {
    resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    return json({ success: false, message: 'Network error reaching Resend: ' + err.message }, 502);
  }

  if (!resendRes.ok) {
    let detail = '';
    try { detail = await resendRes.text(); } catch (_) {}
    return json({ success: false, message: `Resend returned ${resendRes.status}: ${detail.slice(0, 300)}` }, 502);
  }

  return json({ success: true, message: 'Bug report sent' });
}

// ── Helpers ──────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function arrayBufferToBase64(buf) {
  let bin = '';
  const bytes = new Uint8Array(buf);
  // Chunk to avoid call-stack overflow on large files.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}
