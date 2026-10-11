const cacheName = self.location.pathname
const pages = [
{{ if eq .Site.Params.BookServiceWorker "precache" }}
  {{ range .Site.AllPages -}}
  "{{ .RelPermalink }}",
  {{ end -}}
{{ end }}
];

self.addEventListener("install", function (event) {
  self.skipWaiting();

  caches.open(cacheName).then((cache) => {
    return cache.addAll(pages);
  });
});

// Claim open pages on activation (paired with skipWaiting above): without it a
// new worker stays "waiting" until every wiki tab closes, and pages keep
// running the previous generation — whose fetch handler hung GET SSE streams
// (see the pass-through in the fetch listener below).
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }
  // SSE streams (editor presence, the footer online counter): never route
  // them through respondWith — cache.put() on a never-ending body never
  // settles and the page would wait for the stream forever. Let the browser
  // fetch those natively instead.
  if (request.headers.get("Accept") === "text/event-stream") {
    return;
  }

  /**
   * @param {Response} response
   * @returns {Promise<Response>}
   */
  function saveToCache(response) {
    if (cacheable(response)) {
      return caches
        .open(cacheName)
        .then((cache) => cache.put(request, response.clone()))
        .then(() => response);
    } else {
      return response;
    }
  }

  /**
   * @param {Error} error
   */
  function serveFromCache(error) {
    return caches.open(cacheName).then((cache) => cache.match(request.url));
  }

  /**
   * @param {Response} response
   * @returns {Boolean}
   */
  function cacheable(response) {
    return response.type === "basic" && response.ok && !response.headers.has("Content-Disposition")
  }

  event.respondWith(fetch(request).then(saveToCache).catch(serveFromCache));
});
