import { useSyncExternalStore } from "react";

const STORAGE_KEY = "konti_mobile_v2";
const EVENT_NAME = "konti-mobile-v2-change";

function readFlag(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  const param = url.searchParams.get("mobileV2");
  if (param === "1" || param === "true") {
    try { window.localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    return true;
  }
  if (param === "0" || param === "false") {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    return false;
  }
  try { return window.localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  window.addEventListener("popstate", cb);
  window.addEventListener(EVENT_NAME, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("popstate", cb);
    window.removeEventListener(EVENT_NAME, cb);
  };
}

export function useMobileV2Flag(): [boolean, (next: boolean) => void] {
  const enabled = useSyncExternalStore(
    subscribe,
    () => readFlag(),
    () => false,
  );

  const set = (next: boolean) => {
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, "1");
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
    window.dispatchEvent(new Event(EVENT_NAME));
  };

  return [enabled, set];
}
