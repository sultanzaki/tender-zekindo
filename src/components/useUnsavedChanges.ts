"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
export function useUnsavedChanges(dirty: boolean) {
  const [href, setHref] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    function guard(event: MouseEvent) {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const link = (event.target as HTMLElement)?.closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const url = new URL(link.href, location.href);
      if (
        url.origin !== location.origin ||
        url.pathname + url.search === location.pathname + location.search
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setHref(url.pathname + url.search + url.hash);
    }
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guard, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guard, true);
    };
  }, [dirty]);
  return {
    href,
    cancel: () => setHref(null),
    confirm: () => {
      if (href) {
        setHref(null);
        router.push(href);
      }
    },
  };
}
