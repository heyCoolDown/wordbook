// 📦 wordbook Service Worker v1.0
// 집(와이파이): Firebase에서 최신 단어 받고 기기에 저장
// 밖(오프라인): 저장된 단어로 게임 실행

const CACHE_NAME = 'wordbook-v1';

// 앱 실행에 필요한 기본 파일들
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
];

// ── 설치: 앱 껍데기 먼저 캐싱 ──────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── 활성화: 이전 버전 캐시 삭제 ──────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── 요청 처리 ──────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Firebase / Google API → 네트워크 우선 (오프라인이면 캐시)
  // (단어 데이터는 Firebase IndexedDB 캐시가 별도로 처리함)
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebase') ||
    url.includes('googleapis.com')
  ) {
    e.respondWith(
      fetch(e.request)
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 포켓몬/디지몬 이미지 → 캐시 우선 (한번 받으면 저장)
  if (
    url.includes('PokeAPI/sprites') ||
    url.includes('digimon.shadowsmith.com')
  ) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request)
          .then(res => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
            }
            return res;
          })
          .catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // Google Fonts → 캐시 우선
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 앱 파일(index.html 등) → 캐시 우선, 없으면 네트워크, 둘다 실패 → index.html
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request)
        .then(res => {
          if (res && res.status === 200 && e.request.method === 'GET') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
