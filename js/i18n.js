/* ─────────────────────────────────────────────────────────────
   Football Conquest — i18n engine (shared by every marketing page).

   Language resolution order:
     1. Saved toggle choice in localStorage ('fc-lang')         → wins outright
     2. Visitor is in Turkey (Cloudflare /cdn-cgi/trace loc=TR)  → Turkish
     3. Browser/OS language starts with 'tr'                     → Turkish
     4. Otherwise                                                → English

   The Cloudflare country probe needs NO backend function — every site
   served through Cloudflare exposes /cdn-cgi/trace, whose body contains
   a `loc=XX` line with the visitor's ISO country code.

   Markup hooks:
     <span data-i18n="key">            → textContent replaced
     <span data-i18n-html="key">       → innerHTML replaced (for strings with <b>, links)
     <meta data-i18n-attr="content:key"> → named attribute(s) replaced; ";"-separated

   Strings live in window.FC_TRANSLATIONS (js/translations.js), shape:
     { en:{ key:"English" }, tr:{ key:"Türkçe" } }
   A missing tr value transparently falls back to the en value.
   ───────────────────────────────────────────────────────────── */
(function () {
  var STORAGE_KEY = 'fc-lang';
  var SUPPORTED = ['en', 'tr', 'es', 'pt', 'fr', 'de', 'it', 'nl', 'no', 'sv'];
  // Browser-language prefix → app language code.
  // 'en' MUST be listed. detectByBrowser() walks navigator.languages in
  // priority order and returns the first entry that matches ANY prefix here.
  // While English was absent it could never win, so a device set to English
  // with Turkish as a *secondary* locale (["en-CA","tr-TR"]) fell through the
  // English entry and matched Turkish — English was only ever reachable as
  // the no-match fallback. Every supported language needs a row.
  var BROWSER_PREFIX = [
    ['en', 'en'],
    ['tr', 'tr'],
    ['es', 'es'],
    ['pt', 'pt'],
    ['fr', 'fr'],
    ['de', 'de'],
    ['it', 'it'],
    ['nl', 'nl'],
    ['nb', 'no'], ['nn', 'no'], ['no', 'no'],
    ['sv', 'sv']
  ];
  // Cloudflare /cdn-cgi/trace country code → app language code.
  var COUNTRY_LANG = {
    TR: 'tr',
    ES: 'es', MX: 'es', AR: 'es', CL: 'es', CO: 'es', PE: 'es', VE: 'es', UY: 'es', PY: 'es', EC: 'es', BO: 'es', GT: 'es', HN: 'es', NI: 'es', PA: 'es', SV: 'es', CR: 'es', CU: 'es', DO: 'es',
    BR: 'pt', PT: 'pt',
    FR: 'fr', BE: 'fr',
    DE: 'de', AT: 'de', CH: 'de',
    IT: 'it',
    NL: 'nl',
    NO: 'no',
    SE: 'sv'
  };
  function detectByBrowser() {
    var langs = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < langs.length; i++) {
      var lc = (langs[i] || '').toLowerCase();
      for (var j = 0; j < BROWSER_PREFIX.length; j++) {
        if (lc.indexOf(BROWSER_PREFIX[j][0]) === 0) return BROWSER_PREFIX[j][1];
      }
    }
    return null;
  }
  // Legacy alias — older callers might still reference this.
  function browserIsTurkish() { return detectByBrowser() === 'tr'; }
  function savedLang() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return SUPPORTED.indexOf(v) !== -1 ? v : null;
    } catch (e) { return null; }
  }
  function saveLang(l) { try { localStorage.setItem(STORAGE_KEY, l); } catch (e) {} }

  // Resolve the visitor's country via Cloudflare edge → app language code.
  // Returns null if no mapping matches or the probe fails.
  //
  // Skipped entirely inside the Capacitor app: there is no Cloudflare edge in
  // front of a locally-served bundle, so '/cdn-cgi/trace' resolves against the
  // local web server, which answers extension-less paths with index.html — a
  // ~2.3 MB read plus a regex scan on every cold launch, for a result that can
  // only ever be null. The app relies on device locale instead.
  function detectByIP() {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      return Promise.resolve(null);
    }
    return fetch('/cdn-cgi/trace', { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var m = /(^|\n)loc=([A-Z]{2})/.exec(t);
        return (m && COUNTRY_LANG[m[2]]) || null;
      })
      .catch(function () { return null; });
  }
  // Legacy alias for any older callers.
  function inTurkey() { return detectByIP().then(function (l) { return l === 'tr'; }); }

  var FCLang = {
    current: 'en',
    dict: {},
    onChange: [],
    // Look up a key in the active language; fall back to English, then the key.
    // Optional `params` object interpolates {placeholders}: t('log.win',{hero:'X'})
    // replaces every {hero} in the string with 'X'. Used by the simulator's
    // dynamic event-log / modal strings.
    t: function (key, params) {
      var d = this.dict[this.current] || {};
      var en = this.dict.en || {};
      var str = (key in d && d[key] !== '') ? d[key]
              : ((key in en) ? en[key] : key);
      if (params) {
        str = str.replace(/\{(\w+)\}/g, function (m, k) {
          return (k in params) ? params[k] : m;
        });
      }
      return str;
    },
    // Walk the DOM and replace every tagged element/attribute.
    apply: function () {
      document.documentElement.lang = this.current;
      var self = this;
      document.querySelectorAll('[data-i18n]').forEach(function (el) {
        el.textContent = self.t(el.getAttribute('data-i18n'));
      });
      document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
        el.innerHTML = self.t(el.getAttribute('data-i18n-html'));
      });
      document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
        el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
          var bits = pair.split(':');
          if (bits.length === 2) el.setAttribute(bits[0].trim(), self.t(bits[1].trim()));
        });
      });
      // Reflect the active language on any toggle buttons.
      document.querySelectorAll('[data-lang-btn]').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-lang-btn') === self.current);
      });
      this.onChange.forEach(function (fn) { try { fn(self.current); } catch (e) {} });
    },
    // Switch language. `save` persists the choice as a manual override.
    set: function (lang, save) {
      if (SUPPORTED.indexOf(lang) === -1) return;
      this.current = lang;
      if (save) saveLang(lang);
      this.apply();
    },
    boot: function (dict) {
      this.dict = dict || window.FC_TRANSLATIONS || {};
      var self = this;
      var saved = savedLang();
      // ── First paint: decide synchronously, apply with NO network wait ──
      // The page already ships English text in the HTML, so applying the
      // synchronous best guess on DOMContentLoaded means English (and
      // Turkish-browser) visitors never see a delayed re-render flash.
      var initial = saved || detectByBrowser() || 'en';
      self.current = initial;
      function applyNow() { self.apply(); }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyNow);
      } else { applyNow(); }
      // ── Background IP probe ──
      // Only run when no saved choice. If the Cloudflare edge resolves a
      // language different from the synchronous first guess, switch once —
      // a deliberate change, not a load-flash.
      if (!saved) {
        detectByIP().then(function (lang) {
          if (lang && SUPPORTED.indexOf(lang) !== -1 && self.current !== lang) {
            self.set(lang, false);
          }
        });
      }
    }
  };

  window.FCLang = FCLang;
  // Auto-boot once translations.js has defined the dictionary.
  if (window.FC_TRANSLATIONS) FCLang.boot(window.FC_TRANSLATIONS);
  else document.addEventListener('DOMContentLoaded', function () { FCLang.boot(window.FC_TRANSLATIONS); });

  // ── 10-language nav dropdown ────────────────────────────────────
  // Auto-wires any <div class="nav-lang-dropdown" id="nav-lang-dd"> in the
  // page. The button toggles the menu; selecting an item calls FCLang.set().
  // The display label always reflects the active locale.
  var LANG_NATIVE = {
    en: 'EN', tr: 'TR', es: 'ES',
    pt: 'PT', fr: 'FR', de: 'DE',
    it: 'IT', nl: 'NL', no: 'NO',
    sv: 'SV'
  };
  function wireLangDropdown() {
    var dd = document.getElementById('nav-lang-dd');
    if (!dd || dd.dataset.wired) return;
    dd.dataset.wired = '1';
    var trigger = dd.querySelector('.nav-lang-trigger');
    var menu = dd.querySelector('.nav-lang-menu');
    var current = dd.querySelector('.nav-lang-current');
    if (!trigger || !menu || !current) return;
    // Build menu items for every supported language.
    menu.innerHTML = '';
    SUPPORTED.forEach(function (code) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-lang', code);
      btn.textContent = LANG_NATIVE[code] || code.toUpperCase();
      btn.addEventListener('click', function () {
        FCLang.set(code, true);
        dd.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      });
      li.appendChild(btn);
      menu.appendChild(li);
    });
    function refresh() {
      current.textContent = (FCLang.current || 'en').toUpperCase();
      menu.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-lang') === FCLang.current);
      });
    }
    refresh();
    FCLang.onChange.push(refresh);
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var willOpen = !dd.classList.contains('open');
      dd.classList.toggle('open', willOpen);
      trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (!dd.contains(e.target)) {
        dd.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dd.classList.contains('open')) {
        dd.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireLangDropdown);
  } else { wireLangDropdown(); }

  // ── Mobile nav hamburger toggle ────────────────────────────────
  // Toggles a .menu-open class on the parent <nav> element when the
  // hamburger button is clicked. CSS in style.css handles showing the
  // dropdown panel under @media (max-width: 800px). Tapping outside,
  // pressing Escape, or following any link inside the menu closes it.
  function wireHamburger() {
    var btn = document.getElementById('nav-hamburger-btn');
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = '1';
    var nav = btn.closest('nav.nav');
    if (!nav) return;
    function setOpen(open) {
      nav.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!nav.classList.contains('menu-open'));
    });
    // Close when a nav link (not the hamburger or the lang dropdown) is tapped.
    nav.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (a && nav.contains(a) && !e.target.closest('.nav-lang')) {
        setOpen(false);
      }
    });
    // Close on outside-click.
    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target)) setOpen(false);
    });
    // Close on Escape.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('menu-open')) setOpen(false);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireHamburger);
  } else { wireHamburger(); }
})();

/* ── Google Play promo: footer badge (all pages) + dismissible smart banner ──
   The Android app is live, so every marketing page gets a "Get it on Google
   Play" badge in its footer, plus a slim dismissible bottom banner. This file
   loads on EVERY page (incl. simulator.html), so we hard-suppress the promo:
     • inside the native app  (window.Capacitor / _FC_CAP_VERSION) — they're
       already IN the app, and Play policy frowns on cross-promo-to-self;
     • inside an iframe        (simulator.html embedded in play.html) — the
       promo belongs on the wrapper page, not painted over the game;
     • the banner is also skipped on the game page (body.play-page) so a fixed
       bar can never cover the in-game controls — that page still gets the
       footer badge below the game.
   Self-contained: its own tiny 10-language string table + CSS, no dependency on
   translations.js. Uses Google's official hosted badge asset (brand-compliant),
   with a styled text fallback if the image ever fails to load. */
(function () {
  var PLAY_URL = 'https://play.google.com/store/apps/details?id=com.ghiellini.footballconquest';
  var BADGE_IMG = 'https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png';

  var inApp = !!(window.Capacitor || window._FC_CAP_VERSION ||
    (document.body && document.body.classList.contains('fc-capacitor-app')));
  var inFrame = (window.self !== window.top);
  if (inApp || inFrame) return;   // never promote the app inside the app / the game

  // Tiny self-contained banner headline table (badge wordmark stays English —
  // that's how Google's official badge works). Falls back to English.
  var STR = {
    en: 'Play Football Conquest anywhere — now on Android',
    tr: "Football Conquest'i her yerde oyna — artık Android'de",
    es: 'Juega a Football Conquest donde quieras: ya en Android',
    pt: 'Jogue Football Conquest em qualquer lugar — agora no Android',
    fr: 'Jouez à Football Conquest partout — maintenant sur Android',
    de: 'Football Conquest überall spielen — jetzt für Android',
    it: 'Gioca a Football Conquest ovunque — ora su Android',
    nl: 'Speel Football Conquest overal — nu op Android',
    no: 'Spill Football Conquest overalt — nå på Android',
    sv: 'Spela Football Conquest överallt — nu på Android'
  };
  function line() {
    var l = (window.FCLang && FCLang.current) || 'en';
    return STR[l] || STR.en;
  }
  // Badge <a> markup at a given pixel height, with an inline image-load fallback.
  function badgeAnchor(height, cls, extraStyle) {
    var fb = "this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),"
      + "{textContent:'▶ Get it on Google Play',className:'fc-badge-fallback'}))";
    return '<a class="' + cls + '" href="' + PLAY_URL + '" target="_blank" rel="noopener" '
      + 'aria-label="Get it on Google Play" style="display:inline-block;line-height:0;' + (extraStyle || '') + '">'
      + '<img src="' + BADGE_IMG + '" alt="Get it on Google Play" '
      + 'style="height:' + height + 'px;width:auto;display:block" onerror="' + fb + '"></a>';
  }

  function injectStyles() {
    if (document.getElementById('fc-promo-css')) return;
    var s = document.createElement('style');
    s.id = 'fc-promo-css';
    s.textContent =
      '#fc-app-banner{position:fixed;left:0;right:0;bottom:0;z-index:9500;display:flex;align-items:center;gap:14px;'
      + 'padding:9px 14px;background:rgba(9,18,28,.97);border-top:1px solid #23503f;'
      + 'box-shadow:0 -6px 22px rgba(0,0,0,.4);animation:fc-ab-in .35s ease}'
      + '@keyframes fc-ab-in{from{transform:translateY(100%)}to{transform:translateY(0)}}'
      + '#fc-app-banner .fc-ab-text{flex:1;min-width:0;color:#dce8f0;font-size:14px;font-weight:600;line-height:1.3}'
      + '#fc-app-banner .fc-ab-badge{flex-shrink:0}'
      + '#fc-app-banner .fc-ab-x{flex-shrink:0;background:transparent;border:0;color:#8fb0c8;font-size:16px;'
      + 'cursor:pointer;padding:6px 8px;line-height:1;border-radius:6px}'
      + '#fc-app-banner .fc-ab-x:hover{color:#fff;background:rgba(255,255,255,.08)}'
      + '.fc-footer-badge{margin-top:14px}'
      + '.fc-badge-fallback{display:inline-block;background:#00875f;color:#fff;padding:9px 13px;border-radius:8px;'
      + 'font-weight:700;font-size:13px}'
      + '@media(max-width:520px){#fc-app-banner{gap:10px;padding:8px 10px}#fc-app-banner .fc-ab-text{font-size:12.5px}}';
    document.head.appendChild(s);
  }

  // Footer badge — appended once to each page's footer brand block.
  function injectFooterBadge() {
    var brands = document.querySelectorAll('footer.footer .footer-brand');
    brands.forEach(function (brand) {
      if (brand.querySelector('.fc-footer-badge')) return;
      var wrap = document.createElement('div');
      wrap.innerHTML = badgeAnchor(46, 'fc-footer-badge', 'margin-top:14px');
      brand.appendChild(wrap.firstChild);
    });
  }

  // Dismissible bottom banner — skipped on the game page + once dismissed.
  var DISMISS_KEY = 'fc-appbanner-dismissed';
  function injectBanner() {
    if (document.body && document.body.classList.contains('play-page')) return; // game page: badge only
    try { if (localStorage.getItem(DISMISS_KEY) === '1') return; } catch (e) {}
    if (document.getElementById('fc-app-banner')) return;
    var bar = document.createElement('div');
    bar.id = 'fc-app-banner';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Get the Football Conquest app');
    bar.innerHTML = '<span class="fc-ab-text">' + line() + '</span>'
      + badgeAnchor(38, 'fc-ab-badge', '')
      + '<button class="fc-ab-x" type="button" aria-label="Dismiss">✕</button>';
    document.body.appendChild(bar);
    bar.querySelector('.fc-ab-x').addEventListener('click', function () {
      bar.remove();
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
    });
    // Re-localize the headline if the visitor switches language.
    if (window.FCLang && Array.isArray(FCLang.onChange)) {
      FCLang.onChange.push(function () {
        var t = bar.querySelector('.fc-ab-text'); if (t) t.textContent = line();
      });
    }
  }

  function run() { injectStyles(); injectFooterBadge(); injectBanner(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
