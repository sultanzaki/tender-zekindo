"use client";

import { useState } from "react";

function formatDigits(digits: string): string {
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
}

/** Plain-digit numeric input that shows a thousands-separated value while
 * not focused, and the raw digits while being typed into (avoids the
 * cursor-jump bugs that come from formatting on every keystroke). */
export function NumberInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (digits: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const digits = value.replace(/[^0-9]/g, "");

  return (
    <input
      className={className}
      placeholder={placeholder}
      inputMode="numeric"
      value={focused ? digits : formatDigits(digits)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
    />
  );
}
