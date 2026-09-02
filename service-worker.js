/* ============================================================
   Service Worker — العيادة البيطرية
   الغرض: تشغيل الصفحة بلا إنترنت (Offline Shell)
   ⚠️ عند تعديل هذا الملف: ارفع رقم SW_VERSION حتى يُفعَّل التحديث
   ============================================================ */
"use strict";

var SW_VERSION = 'v1';
var CACHE_NAME = 'vetclinic-' + SW_VERSION;

/* الملفات الأساسية التي يجب أن تعمل بلا إنترنت */
var CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
];

/* نطاقات لا تُخزَّن إطلاقاً — تمر مباشرة للشبكة */
var NEVER_CACHE = [
  'script.google.com',
  'docs.google.com',
  'ntfy.sh',
  'googleusercontent.com/gen204'
];

function isNeverCache(url) {
  for (var i = 0; i < NEVER_CACHE.length; i++) {
    if (url.indexOf(NEVER_CACHE[i]) !== -1) return true;
  }
  return false;
}

/* ── التثبيت: تخزين الملفات الأساسية ───────────────────── */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      /* add() لكل ملف على حدة حتى لا يُفشل ملفٌ واحد التثبيت كله */
      return Promise.all(CORE_ASSETS.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' }))
          .catch(function (e) { console.warn('[SW] تعذّر تخزين:', url, e.message); });
      }));
    })
  );
  /* لا نستدعي skipWaiting هنا — ننتظر موافقة المستخدم من الصفحة */
});

/* ── التفعيل: حذف النسخ القديمة ─────────────────────────── */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_NAME && k.indexOf('vetclinic-') === 0) {
          return caches.delete(k);
        }
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* ── رسالة من الصفحة: فعّل التحديث فوراً ────────────────── */
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* ── اعتراض الطلبات ─────────────────────────────────────── */
self.addEventListener('fetch', function (event) {
  var req = event.request;

  /* الكتابة والـ POST تمر كما هي — NetGuard هو من يتعامل معها */
  if (req.method !== 'GET') return;

  var url = req.url;
  if (url.indexOf('http') !== 0) return;          /* chrome-extension وغيرها */
  if (isNeverCache(url)) return;                   /* Apps Script / ntfy */

  /* ① صفحة HTML: الشبكة أولاً، والكاش عند الفشل
        (يضمن حصول المستخدم على أحدث نسخة عند توفر الإنترنت) */
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html')
          .then(function (r) { return r || caches.match('./'); })
          .then(function (r) {
            return r || new Response(
              '<!DOCTYPE html><html lang="ar" dir="rtl"><meta charset="utf-8">' +
              '<body style="font-family:Tahoma;text-align:center;padding:60px">' +
              '<h2>⚠️ التطبيق غير مخزَّن بعد</h2>' +
              '<p>افتح التطبيق مرة واحدة مع وجود إنترنت ليعمل بعدها بلا اتصال.</p>' +
              '</body></html>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
      })
    );
    return;
  }

  /* ② بقية الموارد (Chart.js، الصور، الأيقونات):
        الكاش أولاً مع تحديث صامت في الخلفية */
  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });

      return cached || network;
    })
  );
});
