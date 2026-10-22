import type { SVGProps } from "react";
const paths = {
  overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  tenders: "M4 5h16v15H4zM8 3v4M16 3v4M4 10h16M8 14h3M8 17h7",
  analytics: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  notifications: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10 21h4",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  milestones: "M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1",
  archive: "M3 3h18v4H3zM5 7v14h14V7M10 11h4",
  search: "m21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  download: "M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4",
  account: "M20 21v-2a7 7 0 0 0-14 0v2M13 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
} as const;
export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
