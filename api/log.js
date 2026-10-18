# Wrote api/log.js
module.exports = (req, res) => {
  const { src, data, cookies } = req.query;
  console.log(JSON.stringify({ ts: new Date().toISOString(), src, data, cookies }));
  res.status(200).send('ok');
};
