/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { localDate } from "./domain/dates";
import { notificationFromPush } from "./domain/askPush";
import { withBase } from "./lib/base";

declare let self: ServiceWorkerGlobalScope;

clientsClaim();
self.skipWaiting();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", (event) => {
  let parsed: unknown = null;
  if (event.data) {
    try {
      parsed = event.data.json();
    } catch {
      parsed = { body: event.data.text() };
    }
  }
  const note = notificationFromPush(parsed, localDate());
  event.waitUntil(
    self.registration.showNotification(note.title, {
      body: note.body,
      tag: note.tag,
      icon: withBase("icons/icon-192.png"),
      data: { href: withBase("") },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        await client.focus();
        client.postMessage({ type: "OPEN_TODAY" });
        return;
      }
      await self.clients.openWindow(withBase(""));
    })(),
  );
});
