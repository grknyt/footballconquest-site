/* Football Conquest: move web players to the app (Claude 2026-10-16).
   The browser version stays on 1.2.5; V2 is app-only. Escalates gently:
     visits 1-2  → small banner at the bottom (closable, back next visit)
     visit 3+    → banner + a start-up card once a day ("Get the app" / "Keep playing here")
     SUNSET date → full-screen "we've moved to the app" card, no playing in the browser
   Never runs inside the Android/iOS app (Capacitor). Store links go through /get, which picks the right store. */
(function(){
  var SUNSET = null;            // e.g. '2026-12-01' to retire the browser version on that date (UTC)
  var MODAL_FROM_VISIT = 3;     // start showing the daily card from this visit on
  var GET = '/get/';
  var PLAY = 'https://play.google.com/store/apps/details?id=com.ghiellini.footballconquest';
  var IOS = 'https://apps.apple.com/app/id6807651881';

  try { if (window.Capacitor && (typeof Capacitor.isNativePlatform === 'function' ? Capacitor.isNativePlatform() : Capacitor.platform && Capacitor.platform !== 'web')) return; } catch (e) {}
  if (/[?&]noapp=1/.test(location.search)) return;   // testing / streamers

  // [banner, banner button, card title, card text, get the app, keep playing, moved title, moved text]
  var T = {
    en: ['Football Conquest is better in the app: faster, smoother and getting all the new modes.', 'Get the app', 'Get the free app', 'The browser version is no longer updated. New modes and updates now come to the app only. Free on Android and iPhone.', 'Get the app', 'Keep playing here', 'Football Conquest has moved to the app', 'The browser version has retired. Get the free app on Android or iPhone to keep conquering.'],
    tr: ['Football Conquest uygulamada daha iyi: daha hızlı, daha akıcı ve tüm yeni modlar orada.', 'Uygulamayı indir', 'Ücretsiz uygulamayı indir', 'Tarayıcı sürümü artık güncellenmiyor. Yeni modlar ve güncellemeler artık sadece uygulamaya geliyor. Android ve iPhone için ücretsiz.', 'Uygulamayı indir', 'Burada oynamaya devam et', 'Football Conquest artık uygulamada', 'Tarayıcı sürümü emekliye ayrıldı. Fethetmeye devam etmek için ücretsiz uygulamayı Android veya iPhone\'a indir.'],
    es: ['Football Conquest es mejor en la app: más rápido, más fluido y con todos los modos nuevos.', 'Descargar la app', 'Descarga la app gratis', 'La versión del navegador ya no se actualiza. Los nuevos modos y novedades llegan solo a la app. Gratis en Android y iPhone.', 'Descargar la app', 'Seguir jugando aquí', 'Football Conquest se ha mudado a la app', 'La versión del navegador se ha retirado. Descarga la app gratis en Android o iPhone para seguir conquistando.'],
    pt: ['Football Conquest é melhor no app: mais rápido, mais fluido e com todos os modos novos.', 'Baixar o app', 'Baixe o app grátis', 'A versão do navegador não é mais atualizada. Novos modos e atualizações chegam só ao app. Grátis no Android e iPhone.', 'Baixar o app', 'Continuar jogando aqui', 'Football Conquest agora é só no app', 'A versão do navegador foi aposentada. Baixe o app grátis no Android ou iPhone para continuar conquistando.'],
    fr: ['Football Conquest est meilleur dans l\'appli : plus rapide, plus fluide et avec tous les nouveaux modes.', 'Télécharger l\'appli', 'Télécharge l\'appli gratuite', 'La version navigateur n\'est plus mise à jour. Les nouveaux modes et mises à jour arrivent uniquement sur l\'appli. Gratuite sur Android et iPhone.', 'Télécharger l\'appli', 'Continuer ici', 'Football Conquest est passé sur l\'appli', 'La version navigateur a pris sa retraite. Télécharge l\'appli gratuite sur Android ou iPhone pour continuer à conquérir.'],
    de: ['Football Conquest ist in der App besser: schneller, flüssiger und mit allen neuen Modi.', 'App holen', 'Hol dir die kostenlose App', 'Die Browser-Version wird nicht mehr aktualisiert. Neue Modi und Updates gibt es nur noch in der App. Kostenlos für Android und iPhone.', 'App holen', 'Hier weiterspielen', 'Football Conquest gibt es jetzt in der App', 'Die Browser-Version wurde eingestellt. Hol dir die kostenlose App für Android oder iPhone und erobere weiter.'],
    it: ['Football Conquest è meglio nell\'app: più veloce, più fluido e con tutte le nuove modalità.', 'Scarica l\'app', 'Scarica l\'app gratis', 'La versione browser non viene più aggiornata. Nuove modalità e aggiornamenti arrivano solo nell\'app. Gratis su Android e iPhone.', 'Scarica l\'app', 'Continua a giocare qui', 'Football Conquest ora è nell\'app', 'La versione browser è stata ritirata. Scarica l\'app gratis su Android o iPhone per continuare a conquistare.'],
    nl: ['Football Conquest is beter in de app: sneller, soepeler en met alle nieuwe modi.', 'Download de app', 'Download de gratis app', 'De browserversie wordt niet meer bijgewerkt. Nieuwe modi en updates komen alleen nog in de app. Gratis op Android en iPhone.', 'Download de app', 'Hier verder spelen', 'Football Conquest is verhuisd naar de app', 'De browserversie is gestopt. Download de gratis app op Android of iPhone om verder te veroveren.'],
    sv: ['Football Conquest är bättre i appen: snabbare, smidigare och med alla nya lägen.', 'Hämta appen', 'Hämta gratisappen', 'Webbversionen uppdateras inte längre. Nya lägen och uppdateringar kommer bara till appen. Gratis på Android och iPhone.', 'Hämta appen', 'Fortsätt spela här', 'Football Conquest har flyttat till appen', 'Webbversionen har pensionerats. Hämta gratisappen på Android eller iPhone för att fortsätta erövra.'],
    no: ['Football Conquest er bedre i appen: raskere, jevnere og med alle de nye modusene.', 'Last ned appen', 'Last ned gratisappen', 'Nettleserversjonen oppdateres ikke lenger. Nye moduser og oppdateringer kommer bare i appen. Gratis på Android og iPhone.', 'Last ned appen', 'Fortsett å spille her', 'Football Conquest har flyttet til appen', 'Nettleserversjonen er pensjonert. Last ned gratisappen på Android eller iPhone for å fortsette å erobre.'],
    vi: ['Football Conquest hay hơn trên ứng dụng: nhanh hơn, mượt hơn và có tất cả chế độ mới.', 'Tải ứng dụng', 'Tải ứng dụng miễn phí', 'Phiên bản trình duyệt không còn được cập nhật. Chế độ mới và các bản cập nhật giờ chỉ có trên ứng dụng. Miễn phí trên Android và iPhone.', 'Tải ứng dụng', 'Tiếp tục chơi ở đây', 'Football Conquest đã chuyển sang ứng dụng', 'Phiên bản trình duyệt đã ngừng hoạt động. Tải ứng dụng miễn phí trên Android hoặc iPhone để tiếp tục chinh phục.'],
    id: ['Football Conquest lebih seru di aplikasi: lebih cepat, lebih mulus, dan punya semua mode baru.', 'Unduh aplikasi', 'Unduh aplikasi gratis', 'Versi browser tidak diperbarui lagi. Mode baru dan pembaruan kini hanya hadir di aplikasi. Gratis di Android dan iPhone.', 'Unduh aplikasi', 'Tetap main di sini', 'Football Conquest sudah pindah ke aplikasi', 'Versi browser sudah pensiun. Unduh aplikasi gratis di Android atau iPhone untuk terus menaklukkan.']
  };
  function lang() {
    var c = (window.FCLang && FCLang.current) || '';
    try { c = c || localStorage.getItem('fc-lang') || ''; } catch (e) {}
    c = String(c || navigator.language || 'en').toLowerCase().split('-')[0];
    c = ({ nb: 'no', nn: 'no', 'in': 'id', ms: 'id' })[c] || c;
    return T[c] ? c : 'en';
  }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  var mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  var today = new Date().toISOString().slice(0, 10);
  var retired = SUNSET && today >= SUNSET;
  var visits = +(ls('fc-nudge-visits') || 0) + 1; ls('fc-nudge-visits', visits);
  function track(what) { try { if (window.gtag) gtag('event', 'app_nudge', { action: what, visit: visits }); } catch (e) {} }

  var PLAY_SVG = '<svg viewBox="0 0 512 512" aria-hidden="true"><path fill="#00C3FF" d="M60 20 270 256 60 492z"/><path fill="#00E676" d="M60 20 356 204 270 256z"/><path fill="#FFCE00" d="M356 204 440 256 356 308 270 256z"/><path fill="#FF3A44" d="M270 256 356 308 60 492z"/></svg>';
  var APPLE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9s-2-.9-3.3-.9C6.1 7 4.6 8 3.7 9.5c-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6s1.8-.8 3.3-.8 2 .8 3.3.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.9-1.1-2.9-4.3zM14 5.3c.7-.9 1.2-2 1-3.2-1 .1-2.2.7-2.9 1.6-.6.7-1.2 1.9-1 3.1 1.1.1 2.2-.6 2.9-1.5z"/></svg>';

  function css() {
    if (document.getElementById('fcan-css')) return;
    var s = document.createElement('style'); s.id = 'fcan-css';
    s.textContent =
      '#fcan-bar{position:fixed;left:50%;bottom:calc(10px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483000;width:min(560px,calc(100% - 20px));display:flex;align-items:center;gap:10px;padding:10px 10px 10px 14px;border-radius:14px;background:#081723f2;box-shadow:inset 0 0 0 1.5px #2b4c61,0 10px 28px #000a;color:#eaf4f8;font:13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;animation:fcanUp .35s ease-out}' +
      '#fcan-bar img{width:34px;height:34px;flex:none}#fcan-bar p{margin:0;flex:1}#fcan-bar .s{display:none;font:900 14px/1.2 Montserrat,system-ui,sans-serif}' +
      '@media (max-width:520px){#fcan-bar .l{display:none}#fcan-bar .s{display:inline}}' +
      '#fcan-bar a.go{flex:none;padding:9px 12px;border-radius:10px;background:linear-gradient(180deg,#9af7cd,#6de8b0 45%,#23b37a);color:#05281a;font:900 12px/1 Montserrat,system-ui,sans-serif;text-transform:uppercase;text-decoration:none;white-space:nowrap}' +
      '#fcan-bar button{flex:none;width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:#9fb6c2;font-size:20px;line-height:1;cursor:pointer}' +
      '@keyframes fcanUp{from{opacity:0;transform:translate(-50%,20px)}to{opacity:1;transform:translate(-50%,0)}}' +
      'body.fcan-game:not(.fc-splash-active) #fcan-bar{display:none}' +   /* Claude 2026-10-22: never over the game's start card */
      '#fcan-card{position:fixed;inset:0;z-index:2147483001;display:flex;align-items:center;justify-content:center;padding:20px;background:#020609d9;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}' +
      '#fcan-card .box{width:min(400px,100%);padding:24px 20px 18px;border-radius:20px;background:linear-gradient(180deg,#0f2738,#081723);box-shadow:inset 0 0 0 1.5px #2b4c61,0 18px 40px #000a;color:#eaf4f8;text-align:center;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
      '#fcan-card img.logo{width:72px;height:72px}#fcan-card h2{margin:10px 0 6px;font:italic 900 24px/1.05 Montserrat,system-ui,sans-serif;letter-spacing:-.5px}' +
      '#fcan-card p{margin:0 0 16px;color:#c6dae3}' +
      '#fcan-card a.st{display:flex;align-items:center;gap:12px;margin:10px 0;padding:12px 16px;border-radius:14px;background:linear-gradient(180deg,#1b1f24,#000);box-shadow:inset 0 0 0 1.5px #a6a6a6;color:#fff;text-decoration:none;font:900 15px/1.1 Montserrat,system-ui,sans-serif;text-transform:uppercase;text-align:left}' +
      '#fcan-card a.st svg{width:30px;height:30px;flex:none}#fcan-card a.st small{display:block;font:700 11px/1.2 system-ui,sans-serif;text-transform:none;opacity:.75;margin-top:2px}' +
      '#fcan-card a.go{display:block;margin:10px 0;padding:14px;border-radius:14px;background:linear-gradient(180deg,#9af7cd,#6de8b0 45%,#23b37a);color:#05281a;text-decoration:none;font:900 16px/1 Montserrat,system-ui,sans-serif;text-transform:uppercase;box-shadow:0 5px 0 #06573a}' +
      '#fcan-card button.later{margin-top:6px;border:0;background:none;color:#9fb6c2;font:600 14px system-ui,sans-serif;text-decoration:underline;cursor:pointer;padding:8px}';
    document.head.appendChild(s);
  }
  function stores(t) {
    // phones: one button that opens the right store; computers: both stores
    if (mobile) return '<a class="go" href="' + GET + '" data-w="card_get">' + t[4] + '</a>';
    return '<a class="st" href="' + PLAY + '" target="_blank" rel="noopener" data-w="card_play">' + PLAY_SVG + '<span>Google Play<small>Android</small></span></a>' +
           '<a class="st" href="' + IOS + '" target="_blank" rel="noopener" data-w="card_ios">' + APPLE_SVG + '<span>App Store<small>iPhone &amp; iPad</small></span></a>';
  }
  function card(final) {
    if (document.getElementById('fcan-card')) return;
    css(); var t = T[lang()], d = document.createElement('div'); d.id = 'fcan-card';
    d.innerHTML = '<div class="box"><img class="logo" src="/assets/fc-logo-round.png" alt="" onerror="this.src=\'/assets/fc-logo.png\'">' +
      '<h2>' + (final ? t[6] : t[2]) + '</h2><p>' + (final ? t[7] : t[3]) + '</p>' + stores(t) +
      (final ? '' : '<button class="later" type="button">' + t[5] + '</button>') + '</div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { var a = e.target.closest('[data-w]'); if (a) track(a.getAttribute('data-w')); });
    var later = d.querySelector('.later');
    if (later) later.onclick = function () { track('card_later'); d.remove(); };
    track(final ? 'retired_shown' : 'card_shown');
  }
  function bar() {
    if (document.getElementById('fcan-bar') || sessionStorageGet()) return;
    css(); var t = T[lang()], b = document.createElement('div'); b.id = 'fcan-bar';
    b.innerHTML = '<img src="/assets/fc-logo-round.png" alt="" onerror="this.src=\'/assets/fc-logo.png\'"><p><span class="l">' + t[0] + '</span><span class="s">' + t[2] + '</span></p>' +
      '<a class="go" href="' + GET + '?stay=1" data-w="bar_get">' + t[1] + '</a><button type="button" aria-label="Close">×</button>';
    if (mobile) b.querySelector('a.go').href = GET;
    // Claude 2026-10-22: in the game, show the bar on the home splash only. It used to cover the bottom of the
    // start card, so tapping "Start Conquest" hit the bar (or its store link) instead and the game never started.
    if (document.getElementById('game-panel')) document.body.classList.add('fcan-game');
    document.body.appendChild(b);
    b.querySelector('a.go').onclick = function () { track('bar_get'); };
    b.querySelector('button').onclick = function () { track('bar_close'); b.remove(); try { sessionStorage.setItem('fc-nudge-bar', '1'); } catch (e) {} };
  }
  function sessionStorageGet() { try { return sessionStorage.getItem('fc-nudge-bar'); } catch (e) { return null; } }

  function run() {
    if (retired) { card(true); return; }
    setTimeout(bar, 2500);
    if (visits >= MODAL_FROM_VISIT && ls('fc-nudge-card-day') !== today) {
      ls('fc-nudge-card-day', today);
      setTimeout(function () { card(false); }, 1200);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
