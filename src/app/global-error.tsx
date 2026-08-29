"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/monitoring";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error.message, error.stack ?? null, window.location.pathname).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ padding: 80, textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 20 }}>
            The error has been logged. Try reloading the page.
          </div>
          <button
            onClick={() => reset()}
            style={{
              background: "#1A5F7A",
              color: "#fff",
              border: "none",
              padding: "9px 20px",
              borderRadius: 999,
              fontWeight: 500,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
