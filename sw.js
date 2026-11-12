/* 쉬지 않는 기도 — 오프라인(비행기 모드)용 서비스 워커
   앱 화면(index.html)과 글꼴을 휴대폰에 보관해 두었다가, 인터넷이 없으면 보관본으로 연다.
   인터넷이 있으면 늘 서버의 최신 화면을 먼저 받고 보관본도 새로 바꾼다.
   (기도 기록은 원래부터 휴대폰 안(localStorage)에만 저장되어 있어 따로 할 일이 없다.) */
var CACHE = "prayer-offline-v1";
var APP_URL = new URL("./", self.location).href;
var PRETENDARD_CSS = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

self.addEventListener("install", function(event){
  event.waitUntil((async function(){
    var cache = await caches.open(CACHE);
    await fetch(APP_URL, {cache:"reload"}).then(function(r){ if(r.ok) return cache.put(APP_URL, r); }).catch(function(){});
    precacheCssWithFonts(cache, PRETENDARD_CSS).catch(function(){});
    self.skipWaiting();
  })());
});

self.addEventListener("activate", function(event){
  event.waitUntil((async function(){
    var keys = await caches.keys();
    await Promise.all(keys.filter(function(k){ return k.indexOf("prayer-offline-") === 0 && k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    await self.clients.claim();
  })());
});

async function precacheCssWithFonts(cache, cssUrl){
  var res = await fetch(cssUrl, {mode:"cors"});
  if(!res.ok) return;
  await cache.put(cssUrl, res.clone());
  var css = await res.text();
  var urls = [], re = /url\(([^)]+)\)/g, m;
  while((m = re.exec(css))){ urls.push(new URL(m[1].replace(/["']/g, ""), cssUrl).href); }
  for(var i = 0; i < urls.length; i += 8){
    await Promise.all(urls.slice(i, i + 8).map(function(u){
      return cache.match(u).then(function(hit){
        if(hit) return;
        return fetch(u, {mode:"cors"}).then(function(r){ if(r.ok) return cache.put(u, r); }).catch(function(){});
      });
    }));
  }
}

function isAppPage(req){
  if(req.mode === "navigate") return true;
  var u = new URL(req.url);
  return u.origin === self.location.origin && (u.pathname === new URL(APP_URL).pathname || /\/index\.html$/.test(u.pathname));
}

self.addEventListener("fetch", function(event){
  var req = event.request;
  if(req.method !== "GET") return;
  var url = new URL(req.url);

  /* 1) 앱 화면: 인터넷이 되면 최신 화면(보관본도 갱신), 안 되면(또는 4초 넘게 응답이 없으면) 보관본 */
  if(isAppPage(req) && url.origin === self.location.origin && url.pathname.indexOf(new URL(APP_URL).pathname) === 0){
    if(req.cache === "no-store" && req.mode !== "navigate"){
      event.respondWith(fetch(req).then(function(r){
        if(r.ok){ var copy = r.clone(); caches.open(CACHE).then(function(c){ c.put(APP_URL, copy); }); }
        return r;
      }));
      return;
    }
    event.respondWith((async function(){
      var cache = await caches.open(CACHE);
      var net = fetch(req).then(function(r){ if(r.ok){ cache.put(APP_URL, r.clone()); } return r; });
      var timeout = new Promise(function(resolve){ setTimeout(function(){ resolve(null); }, 4000); });
      try{
        var first = await Promise.race([net, timeout]);
        if(first && first.ok) return first;
      }catch(e){ /* 오프라인 */ }
      var cached = await cache.match(APP_URL) || await cache.match(req, {ignoreSearch:true});
      if(cached) return cached;
      return net;
    })());
    return;
  }

  /* 2) 글꼴: 보관본 먼저 */
  if(url.hostname === "cdn.jsdelivr.net"){
    event.respondWith(caches.open(CACHE).then(function(cache){
      return cache.match(req).then(function(hit){
        if(hit) return hit;
        return fetch(req).then(function(r){ if(r.ok) cache.put(req, r.clone()); return r; });
      });
    }));
  }
});
