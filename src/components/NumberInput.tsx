"use client";

import { useState } from "react";

function formatDigits(digits: string): string {
  if (!digits) return "";
  if (!/^\d*(\.\d*)?$/.test(digits)) return digits;
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
      onBlur={() => {
        setFocused(false);
        if (value.endsWith(".")) onChange(value.slice(0, -1));
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".");
        const next = raw.startsWith(".") ? `0${raw}` : raw;
        if (/^\d*(\.\d*)?$/.test(next)) onChange(next);
      }}
    />
  );
}
