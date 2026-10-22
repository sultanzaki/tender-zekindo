"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/monitoring";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error.message, error.stack ?? null, window.location.pathname).catch(() => {});
  }, [error]);

  return (
    <div style={{ padding: "48px 24px", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-fg1)", marginBottom: 8 }}>
        Something went wrong
      </h1>
      <div style={{ fontSize: 13, color: "var(--color-fg2)", marginBottom: 20 }}>
        Please try again. If the problem continues, contact your administrator.
      </div>
      <button
        onClick={() => reset()}
        style={{
          background: "var(--color-primary)",
          color: "#fff",
          border: "none",
          padding: "9px 20px",
          borderRadius: "var(--radius-full)",
          fontWeight: 500,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}
