// Service worker for push notifications, and for nothing else.
//
// There is deliberately no `fetch` handler here. This app has no build step:
// index.html fetches skupni-koledar.jsx and transforms it in the browser, so
// a worker that intercepted and cached requests would pin whatever version it
// first saw into people's phones, and pushing to main would stop reaching
// them. Without a fetch handler the worker never touches page loads, and
// deploys keep working exactly as they do now.
//
// Adding caching here later would be the single easiest way to break the
// project. If offline support is ever wanted, it needs a versioned cache and
// a deliberate update strategy, not a few convenient lines in this file.

self.addEventListener("install", () => {
  // Take over without waiting for existing tabs to close. Nothing is cached,
  // so there is no half-old, half-new state to be careful about.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  // A push with no readable body still has to show something: browsers
  // require a visible notification for every push received, and dropping one
  // silently is what gets a site's permission revoked.
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Garaža Klub Koledar";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      // Groups repeat notifications about the same event into one line rather
      // than stacking them.
      tag: payload.tag || "koledar",
      data: { url: payload.url || "./" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || "./",
    self.location.href
  ).href;

  // Focus a tab that already has the app open instead of stacking another
  // copy of it; only open a new one when none is running.
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.startsWith(target.split("#")[0]) && "focus" in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow ? self.clients.openWindow(target) : null;
      })
  );
});
