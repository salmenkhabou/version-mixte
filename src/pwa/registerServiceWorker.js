export function registerServiceWorker() {
  if (!('serviceWorker' in globalThis.navigator)) return;

  globalThis.addEventListener('load', () => {
    globalThis.navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => console.warn('Service worker registration failed.', error));
  });
}
