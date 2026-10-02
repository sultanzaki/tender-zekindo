import Link from "next/link";
import { TRACKS, TRACK_LABELS, type Track } from "@/lib/types";
import styles from "./TrackSwitch.module.css";

/** Upstream / downstream selector.
 *
 * A server component that renders plain links, so switching costs no client
 * JavaScript at all, every choice is bookmarkable, and the Back button works.
 * That is the same reasoning as the analytics filters.
 *
 * The page's other query parameters are carried across, so switching track
 * never silently drops what you already filtered or searched for. */
export function TrackSwitch({
  current,
  basePath,
  params = {},
  param = "track",
}: {
  current: Track;
  /** e.g. "/tenders" — needed to build a clean URL when no other filter is set. */
  basePath: string;
  params?: Record<string, string | undefined>;
  param?: string;
}) {
  return (
    <nav className={styles.bar} aria-label="Upstream or downstream">
      <div className={styles.group}>
        {TRACKS.map((track) => {
          const query = new URLSearchParams();
          for (const [key, value] of Object.entries(params)) {
            if (value && key !== param) query.set(key, value);
          }
          if (track !== "upstream") query.set(param, track);
          const qs = query.toString();
          const active = track === current;
          return (
            <Link
              key={track}
              href={qs ? `${basePath}?${qs}` : basePath}
              className={active ? styles.active : styles.item}
              aria-current={active ? "page" : undefined}
            >
              {TRACK_LABELS[track]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
