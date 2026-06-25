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
  // Browser-language prefix → app language code. Order matters for longest-match.
  var BROWSER_PREFIX = [
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
  function detectByIP() {
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
    en: 'EN — English', tr: 'TR — Türkçe', es: 'ES — Español',
    pt: 'PT — Português', fr: 'FR — Français', de: 'DE — Deutsch',
    it: 'IT — Italiano', nl: 'NL — Nederlands', no: 'NO — Norsk',
    sv: 'SV — Svenska'
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
})();
