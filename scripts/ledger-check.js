#!/usr/bin/env node
/**
 * ledger-check.js — Stop hook.
 *
 * Warns when shipped code has moved without the ledger moving with it. A
 * STATE.md that drifts is worse than no STATE.md: it is trusted and wrong.
 *
 * It WARNS, it does not block. A Stop hook that hard-blocks can trap a session
 * with no way out, and a forgotten ledger write is recoverable — unlike a bad
 * commit, which is why commit-gate.js stays the hard block.
 *
 * The measure is stateless on purpose: session boundaries are not knowable
 * from git, but ledger staleness is. It counts commits touching shipped code
 * since STATE.md was last committed, and adds uncommitted shipped changes.
 */

const { execSync } = require('child_process')
const path = require('path')

// "Shipped code" — what a user can be hurt by. Editing docs, specs, the wiki
// or job files does not make the ledger stale.
const SHIPPED = /^(frontend\/src\/|backend\/src\/main\/|scripts\/)/

function repoRoot() {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
  } catch {
    return process.cwd()
  }
}

const REPO = repoRoot()

function git(args) {
  return execSync(`git ${args}`, {
    cwd: REPO,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

/** Never fail a Stop. A hook that errors here just annoys and gets removed. */
function quiet() {
  process.exit(0)
}

function warn(message) {
  process.stdout.write(JSON.stringify({ systemMessage: message }))
  process.exit(0)
}

function main() {
  let lastLedger
  try {
    lastLedger = git('log -1 --format=%H -- STATE.md')
  } catch {
    quiet()
  }
  if (!lastLedger) quiet() // STATE.md never committed; nothing to measure against

  // Commits since the ledger last moved that touched shipped code.
  let staleCommits = []
  try {
    staleCommits = git(`log ${lastLedger}..HEAD --format=%h|%s --name-only`)
      .split(/\n(?=[0-9a-f]{7,}\|)/)
      .filter(Boolean)
      .filter((block) => {
        const [, ...files] = block.split('\n')
        return files.some((f) => SHIPPED.test(f.trim()))
      })
      .map((block) => block.split('\n')[0])
  } catch {
    staleCommits = []
  }

  // Uncommitted shipped changes, and whether STATE.md is among them.
  let dirtyShipped = []
  let ledgerDirty = false
  try {
    for (const line of git('status --porcelain').split('\n').filter(Boolean)) {
      const file = line.slice(3).trim()
      if (file === 'STATE.md') ledgerDirty = true
      if (SHIPPED.test(file)) dirtyShipped.push(file)
    }
  } catch {
    // Fall through; a failed status just means less to report.
  }

  // The ledger is being edited right now — that is the loop working. Say nothing.
  if (ledgerDirty) quiet()
  if (!staleCommits.length && !dirtyShipped.length) quiet()

  const lines = ['STATE.md has not moved, but shipped code has.']

  if (staleCommits.length) {
    lines.push('', `${staleCommits.length} commit(s) since the ledger was last updated:`)
    for (const c of staleCommits.slice(0, 5)) lines.push(`  ${c.replace('|', ' ')}`)
    if (staleCommits.length > 5) lines.push(`  … ${staleCommits.length - 5} more`)
  }

  if (dirtyShipped.length) {
    lines.push('', `${dirtyShipped.length} uncommitted change(s) in shipped paths:`)
    for (const f of dirtyShipped.slice(0, 5)) lines.push(`  ${f}`)
    if (dirtyShipped.length > 5) lines.push(`  … ${dirtyShipped.length - 5} more`)
  }

  lines.push(
    '',
    'Write the delta before closing: what moved from Broken to Live, what is',
    'newly broken, what is now in flight. A ledger that drifts is trusted and wrong.'
  )

  warn(lines.join('\n'))
}

main()
