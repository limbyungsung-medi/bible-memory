/* 말씀암송 오프라인 지원 */
const CACHE="amsong-v2";
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(["./"]).catch(()=>{})))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const req=e.request;if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(req.mode==="navigate"||(url.origin===location.origin&&/\/(index\.html)?$/.test(url.pathname))){
    // 페이지: 인터넷 먼저, 안 되면 저장본
    e.respondWith(fetch(req,{cache:"no-store"}).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put("./",cp))}return res})
      .catch(()=>caches.match("./").then(r=>r||caches.match(req,{ignoreSearch:true}))));
    return;
  }
  if(url.hostname==="cdn.jsdelivr.net"||url.hostname==="cdnjs.cloudflare.com"){
    // 글꼴: 저장본 먼저
    e.respondWith(caches.match(req).then(r=>r||fetch(req).then(res=>{if(res.ok||res.type==="opaque"){const cp=res.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return res})));
  }
});
