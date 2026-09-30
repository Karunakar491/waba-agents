import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const API_TARGET = process.env.E2E_API_TARGET ?? 'https://app.karix.online'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Dev server only — `vite build` ignores `server`, so none of this reaches a
  // bundle. There is no local backend, so a change cannot be seen running
  // without pointing the dev server's /api at a real one. Relative /api/v1 is
  // what the production bundle already uses (.env.production), so the app code
  // needs no dev-only branch. Override the target with E2E_API_TARGET to aim at
  // something other than production.
  server: {
    proxy: {
      '/api': {
        target: API_TARGET,
        // changeOrigin rewrites Host only. The API rejects a browser Origin it
        // does not know with a 403 — correct of it, and the reason a plain
        // proxy gets a 200 from curl and a 403 from a real page. Presenting the
        // target's own origin is what makes the dev server behave like the
        // deployed app; it is not a way around anything, since the API still
        // authenticates every request normally.
        changeOrigin: true,
        headers: { Origin: API_TARGET },
      },
    },
  },
})
