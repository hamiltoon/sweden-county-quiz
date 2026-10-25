/** Registrerar service workern i produktion (den genereras av Vite-pluginet i vite.config.ts). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker kunde inte registreras', err));
  });
}
