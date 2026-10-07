// Resolved hex values mirroring src/app/globals.css custom properties.
// SVG fill/stroke attributes in recharts need concrete colors, not
// var(--...) references, so we keep this one small mapping in sync by hand.
export const CHART_COLORS = {
  primary: "#2563eb",       // blue-600
  primaryDark: "#1d4ed8",   // blue-700
  success: "#16a34a",       // green-600
  error: "#dc2626",         // red-600
  warning: "#d97706",       // amber-600
  gray300: "#94a3b8",       // slate-400
  gray400: "#64748b",       // slate-500
  gray500: "#475569",       // slate-600
  grid: "#e2e8f0",          // slate-200
  axisText: "#94a3b8",      // slate-400
  fg1: "#0f172a",           // slate-900
  fg2: "#334155",           // slate-700
};
