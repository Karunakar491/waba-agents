/**
 * The single-flight rule for silent session renewal.
 *
 * The problem this solves: the access token lives 15 minutes, the server has
 * always issued a 7-day refresh token and exposed POST /auth/refresh, and the
 * frontend never called it. Any 401 hard-navigated to /login, so a user was
 * thrown out mid-task every quarter of an hour and lost whatever they were
 * editing (founder-reported 2026-09-03).
 *
 * THE CONSTRAINT THAT SHAPES ALL OF THIS: the backend rotates the refresh
 * token on every use and detects reuse. Verified against production
 * 2026-09-04 — replaying a consumed refresh token returns
 *
 *   {"success":false,"error":"Token reuse detected. Session revoked."}
 *
 * and kills the session. So two refresh calls racing each other don't merely
 * waste a request, they log the user out *harder* than doing nothing. A naive
 * "refresh on every 401" would have made this bug worse, not better.
 *
 * Hence: exactly one refresh may ever be in flight, and every other caller
 * waits on that same promise.
 *
 * The HTTP call itself is injected rather than built here, so this module
 * holds only the rule and can be tested without a network or a bundler.
 */

/** The single in-flight refresh, or null when none is running. */
let inFlight: Promise<boolean> | null = null

/**
 * Renew the session using `doRefresh`. Concurrent callers share one request
 * and one outcome. Resolves true if the session is now good, false if it could
 * not be renewed. Never throws — callers branch on the boolean.
 */
export function refreshSession(doRefresh: () => Promise<unknown>): Promise<boolean> {
  if (inFlight) return inFlight

  inFlight = doRefresh()
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      // Cleared only after settling, so anyone who arrived mid-flight has
      // already attached to this promise rather than starting a second one.
      inFlight = null
    })

  return inFlight
}

/** Test seam: forget any in-flight refresh. Not used by application code. */
export function resetRefreshStateForTests(): void {
  inFlight = null
}

/**
 * Requests that must never trigger a refresh.
 *
 * - `/auth/refresh` — refreshing a refresh is the infinite loop.
 * - `/auth/login` — a 401 here means wrong password. The user needs to see
 *   that, not have us quietly try to renew a session they don't have.
 * - `/auth/logout` — already on the way out.
 * - `/auth/register` — same reasoning as login.
 */
export function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false
  return /\/auth\/(refresh|login|logout|register)(\?|$|\/)/.test(url)
}
