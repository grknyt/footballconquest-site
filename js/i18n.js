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
  var SUPPORTED = ['en', 'tr'];

  function browserIsTurkish() {
    var langs = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || ''];
    return langs.some(function (l) { return (l || '').toLowerCase().indexOf('tr') === 0; });
  }
  function savedLang() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return SUPPORTED.indexOf(v) !== -1 ? v : null;
    } catch (e) { return null; }
  }
  function saveLang(l) { try { localStorage.setItem(STORAGE_KEY, l); } catch (e) {} }

  // Resolves true if the Cloudflare edge reports the visitor is in Turkey.
  function inTurkey() {
    return fetch('/cdn-cgi/trace', { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var m = /(^|\n)loc=([A-Z]{2})/.exec(t);
        return !!(m && m[2] === 'TR');
      })
      .catch(function () { return false; });
  }

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
      var initial = saved || (browserIsTurkish() ? 'tr' : 'en');
      self.current = initial;
      function applyNow() { self.apply(); }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyNow);
      } else { applyNow(); }
      // ── Background IP probe ──
      // Only relevant when the visitor has NO saved choice and their browser
      // isn't already Turkish. If the Cloudflare edge says they're in Turkey,
      // switch then — a one-time, deliberate change, not a load-flash.
      if (!saved && initial !== 'tr') {
        inTurkey().then(function (isTR) {
          if (isTR && self.current !== 'tr') self.set('tr', false);
        });
      }
    }
  };

  window.FCLang = FCLang;
  // Auto-boot once translations.js has defined the dictionary.
  if (window.FC_TRANSLATIONS) FCLang.boot(window.FC_TRANSLATIONS);
  else document.addEventListener('DOMContentLoaded', function () { FCLang.boot(window.FC_TRANSLATIONS); });
})();
