module.exports = (req, res) => {
  const { src, data, cookies } = req.query;
  console.log(JSON.stringify({ ts: new Date().toISOString(), src, data, cookies }));
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.status(200).send('ok');
};
