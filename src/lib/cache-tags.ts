/**
 * Cache tags for `unstable_cache` entries, invalidated from Server Actions via
 * `revalidateTag`.
 *
 * Kept in one module so a reader can see every cross-request cache in the app
 * and what invalidates it, rather than hunting for tag strings at call sites.
 *
 * Note: this app does NOT enable Next 16's `cacheComponents` (`use cache`), so
 * these are the previous-model APIs. On serverless the built-in cache is
 * per-instance and ephemeral — expect the biggest benefit on warm instances,
 * not a guaranteed cross-request hit.
 */

/** Anything derived from the `tenders` table: the list itself, the dashboard
 * aggregates, and the nav notification counts. */
export const TENDERS_TAG = "tenders";

/** The admin-managed document checklist definitions in `document_types`. */
export const DOCUMENT_TYPES_TAG = "document-types";

/** The global milestone catalog in `milestone_types`. */
export const MILESTONE_TYPES_TAG = "milestone-types";
