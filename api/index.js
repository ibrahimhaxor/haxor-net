module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    url: req.url,
    original: req.headers['x-vercel-original-url'] || null,
    fwdUri: req.headers['x-forwarded-uri'] || null,
    fwdHost: req.headers['x-forwarded-host'] || null,
    host: req.headers.host || null,
    method: req.method
  });
};
