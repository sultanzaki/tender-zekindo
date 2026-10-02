import shared from "./shared.module.css";
import { TRACK_LABELS, type Track } from "@/lib/types";
import styles from "./TrackBadge.module.css";

/** Marks a tender as downstream.
 *
 * Deliberately renders NOTHING for upstream: upstream is every tender that
 * already existed, so a badge on each of the 270 of them would be 270 pieces of
 * noise saying "normal". A downstream tender, on the other hand, looks exactly
 * like an upstream one on any screen that shows both — the notifications page
 * and the archived table do — so there it needs saying. */
export function TrackBadge({ track }: { track: Track }) {
  if (track === "upstream") return null;
  return <span className={`${shared.badge} ${styles.badge}`}>{TRACK_LABELS.downstream}</span>;
}
