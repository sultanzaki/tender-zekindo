// Resolved hex values mirroring src/app/globals.css custom properties.
// SVG fill/stroke attributes in recharts need concrete colors, not
// var(--...) references, so we keep this one small mapping in sync by hand.
export const CHART_COLORS = {
  primary: "#2b8db8",
  primaryDark: "#1a5f7a",
  success: "#28a745",
  error: "#d0021b",
  warning: "#f5a623",
  gray300: "#c8d6df",
  gray400: "#a0b4bf",
  gray500: "#6b8a96",
  grid: "#e0e8ee",
  axisText: "#888888",
  fg1: "#111111",
  fg2: "#444444",
};
