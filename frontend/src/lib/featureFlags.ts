/**
 * Build-time feature flags.
 *
 * Default is OFF for anything unset: a flag must be switched on deliberately,
 * never by forgetting to define it. Read at module load from Vite's compiled
 * env, so flipping one means a rebuild + redeploy of static files — no service
 * restart, no database involvement, which keeps it inside the Kill Switch's
 * five-minute reversibility rule.
 */

function enabled(value: string | undefined): boolean {
  return value === 'true'
}

/**
 * Unpublish / Draft affordances on Skills, UI Skills and FAQ.
 *
 * OFF in production as of 2026-09-03. The backend endpoints and the V54 schema
 * are already live, but the UI carries four findings recorded in TASKS.md #18
 * that have not been addressed: unsafe Delete asymmetry (irreversible Delete
 * fires on click with no confirm, while reversible Unpublish gets a confirm
 * modal), no feature flag, wrong button styling, and a diff-size violation.
 *
 * The components are committed so master builds from a clean checkout — that
 * was the point of landing them — but they stay dark until those findings are
 * closed. Turn on with VITE_FEATURE_UNPUBLISH_UI=true.
 */
export const UNPUBLISH_UI_ENABLED = enabled(import.meta.env.VITE_FEATURE_UNPUBLISH_UI)
