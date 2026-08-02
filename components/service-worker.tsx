"use client";

import { useEffect } from "react";

// Registers the offline service worker (public/sw.js). Production only: in dev
// the worker would cache Next's HMR assets and fight fast refresh — the same
// dev-vs-prod split @vercel/analytics uses. Renders nothing.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // No offline support if this fails — not something the user can act on.
      });
    };

    // Defer to load so the install doesn't compete with first paint.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
