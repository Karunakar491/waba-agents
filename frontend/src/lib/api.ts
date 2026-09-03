import axios, { type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/authStore'
import { isAuthEndpoint, refreshSession } from './authRefresh'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1',
  withCredentials: true, // sends httpOnly cookie on every request
  headers: { 'Content-Type': 'application/json' },
  // QA-caught gap (2026-08-07 audit): no client-side timeout existed at all —
  // a hung browser<->backend connection (distinct from a provider timeout,
  // which the backend already handles) left "Iris is thinking..." spinning
  // forever with no error/retry path. 60s is generous enough for a real AI
  // round-trip through our own backend, which times out its own upstream
  // calls well before this and returns a clean error response.
  timeout: 60000,
})

/**
 * A bare client for the refresh call, deliberately NOT the instance above:
 * refreshing through an instance whose own interceptor triggers a refresh is
 * how you build an infinite loop.
 */
const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

const renewSession = () => refreshSession(() => refreshClient.post('/auth/refresh'))

/** Marks a request we have already retried, so one 401 can't loop. */
type RetriableConfig = InternalAxiosRequestConfig & { _sessionRetry?: boolean }

function giveUpAndSignOut() {
  // Clear the persisted store before navigating, or a stale
  // `isAuthenticated: true` survives in localStorage past the point the
  // session actually died server-side.
  useAuthStore.getState().clearAuth()
  if (window.location.pathname !== '/login') window.location.href = '/login'
}

/**
 * On a 401, renew the session once and replay the request. Only if that fails
 * does the user get sent to the login screen.
 *
 * Before this, every 401 hard-navigated to /login. With a 15-minute access
 * token and a refresh endpoint the frontend never called, that meant being
 * thrown out mid-task four times an hour, losing unsaved work — a half-filled
 * agent wizard, an edited skill (founder-reported 2026-09-03).
 *
 * See authRefresh.ts for why the refresh is single-flight: the server rotates
 * refresh tokens and revokes the session on reuse, so racing refreshes are
 * actively harmful.
 */
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config as RetriableConfig | undefined
    const status = err.response?.status

    if (status !== 401 || !config || config._sessionRetry || isAuthEndpoint(config.url)) {
      // A 401 we can't or shouldn't recover from. Only sign out if this looks
      // like a dead session rather than, say, a rejected login.
      if (status === 401 && !isAuthEndpoint(config?.url)) giveUpAndSignOut()
      return Promise.reject(err)
    }

    config._sessionRetry = true
    const renewed = await renewSession()

    if (!renewed) {
      // The refresh failed — but not necessarily because the session is dead.
      // Cookies are shared across tabs while this single-flight guard is
      // per-tab, so another tab may have just rotated the token and had ours
      // rejected as a replay. Replaying the original request costs one call
      // and distinguishes "someone else already renewed it" from "genuinely
      // logged out", instead of signing the user out on a race.
      try {
        return await api.request(config)
      } catch (retryErr) {
        giveUpAndSignOut()
        return Promise.reject(retryErr)
      }
    }

    return api.request(config)
  }
)

export default api
