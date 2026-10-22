"use client";

import { useState } from "react";

function formatDigits(digits: string): string {
  if (!digits) return "";
  const [whole, fraction] = digits.split(".");
  const grouped = BigInt(whole || "0").toLocaleString("id-ID");
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}

/** Decimal input that preserves fractions and shows a grouped value while
 * not focused, and a dot-decimal value while being typed into (avoids the
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
  const digits = value;

  return (
    <input
      className={className}
      placeholder={placeholder}
      inputMode="decimal"
      value={focused ? digits : formatDigits(digits)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const next = e.target.value.replace(",", ".");
        if (/^\d*(\.\d*)?$/.test(next)) onChange(next);
      }}
    />
  );
}
