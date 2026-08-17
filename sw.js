// ============================================================
// SW.JS — Service Worker do FinApp (PWA Offline & Cache)
// ------------------------------------------------------------
// 1. Pré-cache de arquivos estáticos essenciais (App Shell)
// 2. Estratégia Stale-While-Revalidate para assets estáticos
// 3. Estratégia Network-First para requisições do Supabase (dados em tempo real)
// 4. Limpeza automática de caches obsoletos na ativação
// ============================================================

const CACHE_NAME = 'finapp-static-v2';
const DATA_CACHE_NAME = 'finapp-runtime-v2';

// Lista de arquivos do App Shell para pré-armazenamento no cache
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.html',
  './manifest.json',
  './favicon-16x16.png',
  './css/auth.css',
  './css/app.css',
  './js/supabase.js',
  './js/data.js',
  './js/auth.js',
  './js/dashboard.js',
  './js/reports.js',
  './js/settings.js',
  './js/app.js',
  './js/sw-register.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './icons/apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js',
  'https://esm.sh/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap'
];

// ============================================================
// 1. EVENTO: INSTALL (Instalação e Pré-cache)
// ============================================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('[Service Worker] Pré-armazenando arquivos essenciais no cache...');
      // Tenta armazenar cada item individualmente para evitar falha total caso um CDN falhe
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[Service Worker] Aviso: não foi possível cachear:', asset, err);
        }
      }
    }).then(() => self.skipWaiting()) // Força o novo Service Worker a assumir o controle imediatamente
  );
});

// ============================================================
// 2. EVENTO: ACTIVATE (Limpeza de Caches Antigos)
// ============================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(
        keyList.map(key => {
          if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
            console.log('[Service Worker] Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()) // Assume controle das abas abertas imediatamente
  );
});

// ============================================================
// 3. EVENTO: FETCH (Interceptação e Estratégias de Cache)
// ============================================================
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Não intercepta requisições não-GET (como POST de autenticação / inserts)
  if (event.request.method !== 'GET') {
    return;
  }

  // A) Requisições para a API do Supabase (*.supabase.co) -> Network-First
  if (requestUrl.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // Clona a resposta e guarda uma cópia no cache dinâmico de dados
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(DATA_CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Se estiver offline, tenta responder com a última cópia salva no cache
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response(JSON.stringify({ error: 'Você está offline e não há dados em cache para esta consulta.' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // B) Navegações e arquivos estáticos (HTML, CSS, JS, Imagens, Fontes) -> Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Dispara busca na rede em background para atualizar o cache
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(err => {
        // Falha de rede normal quando offline
      });

      // Retorna a versão rápida do cache se existir, ou aguarda a rede
      return cachedResponse || fetchPromise;
    })
  );
});
