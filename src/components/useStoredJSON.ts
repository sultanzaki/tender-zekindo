"use client";
import { useMemo, useSyncExternalStore } from "react";
const EVENT = "zekindo-preferences";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}
export function useStoredJSON<T>(
  key: string,
  fallback: T,
): [T, (value: T) => boolean] {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) || "";
      } catch {
        return "";
      }
    },
    () => "",
  );
  const value = useMemo(() => {
    try {
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }, [raw, fallback]);
  function save(next: T) {
    try {
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
      return true;
    } catch {
      return false;
    }
  }
  return [value, save];
}
