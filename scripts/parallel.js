#!/usr/bin/env node
/**
 * parallel.js — who is touching production right now, and who is not.
 *
 * Two sessions worked this repo on 2026-09-24 and collided twice in one
 * morning. Once, both deployed the frontend minutes apart and the loser was
 * never told: work that was live at 05:10 was gone by 05:22 and nobody
 * noticed until the ledger was re-read. Once, a jar build died because the
 * other session was mid-rename in the same worktree.
 *
 * Neither was a mistake anybody made. Both were the same missing thing: no
 * point of serialization on a shared resource. Production is one box, one
 * /var/www/metaagent and one jar, however many chats are open.
 *
 * This file owns the lock. `deploy-guard.js` enforces it as a hook, so the
 * rule is a mechanism rather than a paragraph somebody has to remember.
 *
 * The lock lives in the git COMMON dir, not the working tree: every worktree
 * of this repo shares it, which is exactly the set of sessions that can
 * collide. A file in the working tree would be invisible to the other
 * worktrees and so would lock nothing.
 *
 * Usage:
 *   node scripts/parallel.js status     — who holds the lock, and for how long
 *   node scripts/parallel.js release    — give it up (the hook does this for you)
 *   node scripts/parallel.js break      — take a stale lock away, deliberately
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

/** A lock older than this is stale: a session died, or forgot to release. */
const LOCK_MINUTES = 60

function gitCommonDir(cwd) {
  const out = execSync('git rev-parse --git-common-dir', {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
  return path.resolve(cwd || process.cwd(), out)
}

function lockPath(cwd) {
  return path.join(gitCommonDir(cwd), 'parallel-deploy-lock.json')
}

function readLock(cwd) {
  try {
    const raw = fs.readFileSync(lockPath(cwd), 'utf8')
    const lock = JSON.parse(raw)
    return lock && lock.session ? lock : null
  } catch {
    return null
  }
}

function ageMinutes(lock) {
  return (Date.now() - new Date(lock.at).getTime()) / 60000
}

function isStale(lock) {
  return !lock || !Number.isFinite(ageMinutes(lock)) || ageMinutes(lock) > LOCK_MINUTES
}

function writeLock(cwd, lock) {
  fs.writeFileSync(lockPath(cwd), JSON.stringify(lock, null, 2))
}

function clearLock(cwd) {
  try {
    fs.unlinkSync(lockPath(cwd))
    return true
  } catch {
    return false
  }
}

/**
 * What actually ends up inside each artefact.
 *
 * Scoped per artefact rather than one list for both, because the question is
 * not "is this tree tidy" but "could this edit be inside the thing I am about
 * to put on production". A half-written release note cannot be. Somebody's
 * half-finished controller can.
 *
 * `frontend/e2e/` is in neither: specs drive the app, they are not built into
 * it. Flagging them would be the cry-wolf failure that gets a guard switched
 * off — raised by the other session, which had exactly those files dirty while
 * its backend work was the real hazard.
 */
const IN_ARTEFACT = {
  jar: /^backend\/(src\/main\/|pom\.xml)/,
  bundle: /^frontend\/(src\/|index\.html|vite\.config|package(-lock)?\.json)/,
}
const SHIPPED = new RegExp(`(${IN_ARTEFACT.jar.source})|(${IN_ARTEFACT.bundle.source})`)

function dirtyShippedFiles(cwd, scope) {
  const match = scope && IN_ARTEFACT[scope] ? IN_ARTEFACT[scope] : SHIPPED
  try {
    const out = execSync('git status --porcelain', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 8,
    })
    return out
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => ({ status: l.slice(0, 2).trim(), file: l.slice(3).trim() }))
      .filter((d) => match.test(d.file))
  } catch {
    return []
  }
}

/**
 * `/d/wt-build/...` is a Git Bash path; this hook is Node on Windows, where
 * that directory does not exist under that name. Every command in this repo is
 * written in the former and every check runs in the latter, so without this
 * translation nothing resolves and the guard silently decides it cannot
 * attribute anything — which looks exactly like working correctly.
 */
function msysToWindows(p) {
  if (process.platform !== 'win32' || typeof p !== 'string') return p
  return p.replace(/^\/([a-zA-Z])\//, (_, drive) => `${drive.toUpperCase()}:\\`)
}

/**
 * The worktree an artefact was actually built in, from its own path.
 *
 * Derived from the artefact, never from the session's working directory. The
 * detached-worktree workflow this guard recommends *guarantees* those two are
 * different directories, so checking cwd could only ever be right by luck —
 * and on 2026-09-24 it was wrong, refusing a jar built in a clean
 * `/d/wt-build` because the session's own checkout had unrelated edits.
 *
 * Returns null when the path is outside any repo — a tarball staged in a temp
 * directory carries no provenance, and a guard cannot honestly claim to know
 * what is inside it.
 */
function artefactWorktree(artefactPath, cwd) {
  if (!artefactPath) return null
  const wanted = msysToWindows(artefactPath)
  const abs = path.isAbsolute(wanted) ? wanted : path.resolve(msysToWindows(cwd || '.'), wanted)

  // Walk up to the nearest directory that exists. `backend/target/` may not be
  // there yet, or at all, and git cannot run from a directory that is absent —
  // which would silently return "unattributable" for a perfectly locatable
  // artefact.
  let dir = path.dirname(abs)
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(dir)) break
    const up = path.dirname(dir)
    if (up === dir) return null
    dir = up
  }
  if (!fs.existsSync(dir)) return null

  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return null
  }
}

function describe(lock) {
  const mins = Math.round(ageMinutes(lock))
  return (
    `held by ${lock.session} for ${mins} min\n` +
    `  what    : ${lock.what}\n` +
    `  from    : ${lock.worktree}\n` +
    `  since   : ${lock.at}`
  )
}

// ------------------------------------------------------------------ the CLI

function main() {
  const cmd = process.argv[2] || 'status'
  const cwd = process.cwd()

  if (cmd === 'status') {
    const lock = readLock(cwd)
    console.log(`deploy lock: ${lockPath(cwd)}`)
    if (!lock) {
      console.log('\nFREE — nobody is touching production.')
    } else if (isStale(lock)) {
      console.log(`\nSTALE (over ${LOCK_MINUTES} min old)\n  ${describe(lock)}`)
      console.log('\nThe next production command takes it automatically.')
    } else {
      console.log(`\nHELD\n  ${describe(lock)}`)
      console.log('\nAnother session must wait, or ask that one to release.')
    }

    console.log('\nworktrees (one session each, never shared):')
    try {
      console.log(
        execSync('git worktree list', { cwd, encoding: 'utf8' })
          .trimEnd()
          .split('\n')
          .map((l) => `  ${l}`)
          .join('\n')
      )
    } catch {
      /* not fatal — status is informational */
    }

    const dirty = dirtyShippedFiles(cwd)
    console.log(`\nuncommitted shipped code in this worktree: ${dirty.length}`)
    for (const d of dirty.slice(0, 10)) console.log(`  ${d.status} ${d.file}`)
    return
  }

  if (cmd === 'release') {
    const lock = readLock(cwd)
    if (!lock) {
      console.log('Nothing to release — the lock is already free.')
      return
    }
    clearLock(cwd)
    console.log(`Released. Was ${describe(lock)}`)
    return
  }

  if (cmd === 'break') {
    const lock = readLock(cwd)
    if (!lock) {
      console.log('Nothing to break — the lock is already free.')
      return
    }
    if (!isStale(lock)) {
      console.log(
        `REFUSED — that lock is live, not stale (${Math.round(ageMinutes(lock))} min old).\n\n` +
          `${describe(lock)}\n\n` +
          'Ask that session to release it. Breaking a live lock is how two ' +
          'deploys end up overwriting each other, which is the thing this exists to stop.'
      )
      process.exitCode = 1
      return
    }
    clearLock(cwd)
    console.log(`Broke a stale lock. Was ${describe(lock)}`)
    return
  }

  console.log('usage: node scripts/parallel.js [status|release|break]')
  process.exitCode = 1
}

module.exports = {
  LOCK_MINUTES,
  readLock,
  writeLock,
  clearLock,
  isStale,
  ageMinutes,
  describe,
  dirtyShippedFiles,
  artefactWorktree,
  lockPath,
}

if (require.main === module) main()
