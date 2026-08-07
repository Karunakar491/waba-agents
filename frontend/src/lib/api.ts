import axios from 'axios'
import { useAuthStore } from '../store/authStore'

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

// Treat 401 responses as session expiry — clear the persisted auth store
// before redirecting, or a stale `isAuthenticated: true` survives in
// localStorage past the point the session actually died server-side.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
