const CACHE="mosque-mobile-v8-2";
const APP_SHELL=["/","/app","/mobile-app.html","/manifest.webmanifest","/app-icon.svg","/quran/index.json","/vendor/cairo/400.css","/vendor/cairo/600.css","/vendor/cairo/700.css","/vendor/cairo/800.css"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=="GET"||url.origin!==location.origin||url.pathname.startsWith("/api/")||url.pathname.startsWith("/socket.io/"))return;
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match("/mobile-app.html"))));
});

self.addEventListener("push",event=>{
  const data=event.data?event.data.json():{};
  event.waitUntil(self.registration.showNotification(data.title||"تنبيه الصلاة",{
    body:data.message||"حان الآن موعد الأذان",
    icon:"/app-icon.svg",
    badge:"/app-icon.svg",
    dir:"rtl",
    vibrate:[200,100,200]
  }));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(windows=>{
    const existing=windows.find(client=>client.url.startsWith(location.origin));
    return existing?existing.focus():clients.openWindow("/");
  }));
});
