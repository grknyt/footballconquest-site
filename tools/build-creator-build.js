#!/usr/bin/env node
/*
 * build-creator-build.js — regenerate the Shopify "Creator Build" (offline)
 * from the live simulator.html. Run whenever simulator.html changes:
 *
 *     node tools/build-creator-build.js
 *
 * Transforms (mirrors how the original Creator Build was hand-built):
 *   1. <title> → "Football Conquest — Creator Build"
 *   2. remove class="web-build" from <body>  → re-enables the creator tools
 *      (manual score inputs, Confirm Result, Undo/Redo menu items, Ctrl/⌘+Z)
 *   3. inline /js/translations.js and /js/i18n.js so the file works when
 *      double-clicked from disk (file://) with no local web server
 *   4. add the fixed "CREATOR BUILD" banner (hideable via its ✕, and auto-
 *      hidden by the H "Hide UI" toggle for clean recording)
 *
 * d3, topojson, Google Fonts and the world-atlas map JSON stay on their CDNs
 * (they load fine over https from a file:// page) — same as the original.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');                       // repo root
const SIM  = path.join(ROOT, 'simulator.html');
const TRANSLATIONS = path.join(ROOT, 'js', 'translations.js');
const I18N = path.join(ROOT, 'js', 'i18n.js');

// Customer-facing release label. Pass a clean product version when you cut a
// new store build:  FC_RELEASE=v1.2 node tools/build-creator-build.js
// If omitted it falls back to today's date so the file still sorts newest-last.
const RELEASE = (process.env.FC_RELEASE || new Date().toISOString().slice(0, 10)).trim();

// Output: builds are collected in the "Creator Build" folder inside the
// FootballConquestHQ workspace. The release label is stamped into the filename
// so each upload is visibly newer, e.g. Ghiellini-Football-Conquest-Creator-Build-v1.2.html
const OUT = process.env.FC_CREATOR_OUT ||
  path.join(ROOT, '..', '..', 'CoworkOS', 'FootballConquestHQ', 'Creator Build',
            'Ghiellini-Football-Conquest-Creator-Build-' + RELEASE + '.html');

function must(cond, msg){ if(!cond){ console.error('✗ ' + msg); process.exit(1); } }

let html = fs.readFileSync(SIM, 'utf8');
const translations = fs.readFileSync(TRANSLATIONS, 'utf8');
const i18n = fs.readFileSync(I18N, 'utf8');

// 1. Title.
must(html.includes('<title>Football Conquest</title>'), 'live <title> not found');
html = html.replace('<title>Football Conquest</title>',
                    '<title>Football Conquest — Creator Build</title>');

// 2. Remove web-build + inject the banner HTML in one shot (targets the real
//    body tag unambiguously — the only <body ...> with the web-build class).
const BANNER_HTML =
  '<div class="fc-creator-banner"><span class="fc-creator-banner-mark">FC</span>' +
  'FOOTBALL CONQUEST · CREATOR BUILD ' + RELEASE + ' · MANUAL SCORE · CTRL/CMD+Z UNDO · H HIDE UI</div>' +
  '<button class="fc-creator-banner-toggle" type="button" ' +
  'onclick="document.body.classList.toggle(\'fc-banner-hidden\')" ' +
  'title="Hide creator banner">x</button>';
must(html.includes('<body class="web-build">'), '<body class="web-build"> not found');
html = html.replace('<body class="web-build">', '<body>\n' + BANNER_HTML);

// 3. Inline the two local JS files (replace their /js/ <script src> tags).
must(/<script src="\/js\/translations\.js[^"]*"><\/script>/.test(html), 'translations.js tag not found');
must(/<script src="\/js\/i18n\.js[^"]*"><\/script>/.test(html), 'i18n.js tag not found');
html = html.replace(/<script src="\/js\/translations\.js[^"]*"><\/script>/,
                    '<script>\n/* inlined js/translations.js */\n' + translations + '\n</script>');
html = html.replace(/<script src="\/js\/i18n\.js[^"]*"><\/script>/,
                    '<script>\n/* inlined js/i18n.js */\n' + i18n + '\n</script>');

// 4. Banner CSS — inject before </head>.
const BANNER_CSS =
  '<style id="fc-creator-banner-css">' +
  '.fc-creator-banner{position:fixed;top:0;left:0;right:0;height:24px;' +
  'background:linear-gradient(90deg,#c8102e,#7a0a1d);color:#fff;' +
  'font:600 11px/24px Menlo,Consolas,monospace;letter-spacing:2px;display:flex;' +
  'align-items:center;justify-content:center;gap:8px;z-index:9999;' +
  'text-transform:uppercase;user-select:none;pointer-events:none;}' +
  '.fc-creator-banner-mark{display:inline-flex;align-items:center;justify-content:center;' +
  'width:18px;height:18px;border-radius:3px;background:#0a1929;' +
  'border:1px solid rgba(212,169,54,0.55);color:#c8102e;' +
  "font-family:Impact,Haettenschweiler,'Arial Narrow Bold',sans-serif;" +
  'font-size:12px;font-weight:900;letter-spacing:0;line-height:1;}' +
  '.fc-creator-banner-toggle{position:fixed;top:0;right:0;width:24px;height:24px;' +
  'background:transparent;border:0;color:#fff;font:600 11px/24px monospace;' +
  'cursor:pointer;z-index:10000;}' +
  'body.fc-banner-hidden .fc-creator-banner{display:none;}' +
  'body.fc-ui-hidden .fc-creator-banner,body.fc-ui-hidden .fc-creator-banner-toggle{display:none;}' +
  '</style>';
must(html.includes('</head>'), '</head> not found');
html = html.replace('</head>', BANNER_CSS + '\n</head>');

// 5. Inline root-relative /assets/ IMAGE references as data URIs. A leading
//    "/assets/..." path resolves to the drive root under file://, so the
//    single-file build would 404 them (e.g. the map-backdrop FC watermark,
//    which then renders as broken-image tiles). Audio (/assets/*.mp3) is left
//    alone — it lives in JS strings and already falls back to the Web-Audio
//    synth when the file is absent.
const MIME = {'.png':'image/png', '.svg':'image/svg+xml', '.jpg':'image/jpeg',
              '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif'};
const assetRefs = new Set();
html.replace(/(?:href|src)="(\/assets\/[^"?]+)(?:\?[^"]*)?"/g, (m, p) => { assetRefs.add(p); return m; });
let inlined = 0, missed = 0;
assetRefs.forEach(rel => {
  const ext = path.extname(rel).toLowerCase();
  if (!MIME[ext]) return;                       // skip non-images (audio, json…)
  const file = path.join(ROOT, rel.replace(/^\//, ''));
  if (!fs.existsSync(file)) { console.warn('  ! asset not found, left as-is: ' + rel); missed++; return; }
  const dataUri = 'data:' + MIME[ext] + ';base64,' + fs.readFileSync(file).toString('base64');
  const re = new RegExp('((?:href|src)=")' +
             rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\?[^"]*)?(")', 'g');
  html = html.replace(re, (m, a, b) => a + dataUri + b);
  inlined++;
});
console.log('  inlined ' + inlined + ' /assets image(s)' + (missed ? (', ' + missed + ' missing') : ''));

fs.mkdirSync(path.dirname(OUT), { recursive: true });   // ensure the Creator Build folder exists
fs.writeFileSync(OUT, html);
console.log('✓ Creator Build written: ' + OUT);
console.log('  size: ' + (Buffer.byteLength(html) / 1048576).toFixed(2) + ' MB');
