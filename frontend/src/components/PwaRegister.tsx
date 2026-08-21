"use client";

import { useEffect } from "react";

/** Registers the service worker so the app is installable and opens
 * instantly on repeat visits -- required for a clean "Add to Home Screen"
 * experience on Android and satisfies Chrome's install-prompt criteria. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal: the site still works fully without offline support.
      });
    }
  }, []);
  return null;
}
