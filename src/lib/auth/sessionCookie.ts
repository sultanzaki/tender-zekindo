// Deliberately dependency-free (no node:crypto, no next/headers) so
// proxy.ts — which runs in the Edge runtime — can import just the cookie
// name without pulling in Node-only APIs from session.ts.
export const SESSION_COOKIE_NAME = "zk_session";
