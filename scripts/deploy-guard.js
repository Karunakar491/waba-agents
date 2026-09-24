#!/usr/bin/env node
/**
 * deploy-guard.js — PreToolUse hook on Bash/PowerShell.
 *
 * Makes two rules mechanical, because both were broken on 2026-09-24 by
 * sessions that were each being careful:
 *
 *   1. One session touches production at a time. Two frontend deploys went out
 *      twelve minutes apart, the second built from a branch without the first's
 *      commits, and the loser was never told its work had been erased.
 *
 *   2. Nothing is deployed from a worktree with uncommitted shipped code. A
 *      jar build failed mid-rename in a shared worktree; had the rename been
 *      one commit further along it would have built cleanly and shipped
 *      somebody's unfinished controller to production instead.
 *
 * The lock is taken automatically by the first production command a session
 * runs, so there is no ceremony to remember and no way to forget it. It is
 * released explicitly, or it expires (see parallel.js).
 *
 * Deliberately NOT blocked: reads. Checking what is live, tailing a log or
 * curling the site is how you find out whether it is safe to act, so a guard
 * that made those harder would make production less safe, not more.
 */

const { readLock, writeLock, isStale, describe, dirtyShippedFiles } = require('./parallel')

/** Commands that change production. Reads are absent on purpose. */
const PRODUCTION_WRITES = [
  { re: /\bscp\b[^|;&]*\bubuntu@10\.1\.17\.16:/, name: 'scp to the production box' },
  { re: /\bsystemctl\s+(restart|stop|start)\s+metaagent\b/, name: 'restarting the backend service' },
  { re: /\bmv\b[^|;&]*\/var\/www\/metaagent/, name: 'swapping the frontend bundle' },
  { re: /\brm\s+-rf\b[^|;&]*\/var\/www\/metaagent/, name: 'removing the frontend bundle' },
  { re: /\bcp\b[^|;&]*\/opt\/metaagent\/target\/[^|;&]*\.jar/, name: 'swapping the backend jar' },
  { re: /\btar\s+xzf\b[^|;&]*-C\s+\/var\/www/, name: 'unpacking into the web root' },
]

/** Uploading an artefact — the point where a dirty tree stops being harmless. */
const ARTEFACT_UPLOAD = /\bscp\b[^|;&]*\b(dist[^|;&]*\.tar\.gz|[^|;&]*\.jar)\b[^|;&]*ubuntu@10\.1\.17\.16:/

/**
 * A command only counts if it can actually reach the box. Everything above
 * describes what is done ON production, and from here that is always wrapped
 * in ssh, scp or rsync.
 *
 * Without this, the guard fired on its own name: a command merely quoting
 * "systemctl restart metaagent" — a test payload, a runbook, a report to the
 * founder — took the lock and could have denied the next session. Matching
 * text that describes an action, rather than an action, is the same mistake
 * the heredoc strip exists to prevent.
 */
const REACHES_PRODUCTION = /\b(ssh|scp|rsync)\b|10\.1\.17\.16/

/** Feeding a payload to this guard is a test of it, never a deploy. */
const SELF_TEST = /\bscripts[/\\]deploy-guard\.js\b/

const RELEASE = /\bparallel(\.js)?\s+(release|break)\b/

function respond(decision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    })
  )
  process.exit(0)
}

const allow = () => process.exit(0)
const deny = (reason) => respond('deny', reason)

/**
 * A heredoc body is data, not a command — the same reason git-guard strips
 * them. A deploy runbook quoted into a commit message must not read as a
 * deploy.
 */
function stripHeredocs(command) {
  return command.replace(/<<-?\s*'?([A-Za-z_][A-Za-z0-9_]*)'?[\s\S]*?^\s*\1\s*$/gm, '<<HEREDOC')
}

function main() {
  let payload
  try {
    payload = JSON.parse(require('fs').readFileSync(0, 'utf8'))
  } catch {
    allow()
  }

  const command = payload?.tool_input?.command
  if (typeof command !== 'string') allow()
  const session = payload?.session_id || 'unknown-session'
  const cwd = payload?.cwd || process.cwd()
  const text = stripHeredocs(command)

  // Releasing is always allowed, and is how a session hands production on.
  if (RELEASE.test(text)) allow()
  if (SELF_TEST.test(text)) allow()
  if (!REACHES_PRODUCTION.test(text)) allow()

  const hit = PRODUCTION_WRITES.find((p) => p.re.test(text))
  if (!hit) allow()

  // ---------------------------------------------------------------- rule 1
  let lock
  try {
    lock = readLock(cwd)
  } catch {
    allow() // not a git worktree, or no repo — not our business
  }

  if (lock && lock.session !== session && !isStale(lock)) {
    deny(
      `BLOCKED — another session is deploying right now.\n\n` +
        `${describe(lock)}\n\n` +
        `You were about to: ${hit.name}.\n\n` +
        `Production is one box, one bundle and one jar however many chats are ` +
        `open. Two deploys minutes apart is how work that was live at 05:10 ` +
        `was gone by 05:22 on 2026-09-24, with nobody told.\n\n` +
        `Wait, or message that session and ask it to run:\n` +
        `  node scripts/parallel.js release\n\n` +
        `If you believe it has died, check and then break it deliberately:\n` +
        `  node scripts/parallel.js status\n` +
        `  node scripts/parallel.js break`
    )
  }

  // ---------------------------------------------------------------- rule 2
  if (ARTEFACT_UPLOAD.test(text)) {
    const dirty = dirtyShippedFiles(cwd)
    if (dirty.length) {
      const list = dirty.slice(0, 10).map((d) => `  ${d.status} ${d.file}`)
      if (dirty.length > 10) list.push(`  … ${dirty.length - 10} more`)
      deny(
        `BLOCKED — you are about to upload an artefact built from a worktree ` +
          `with ${dirty.length} uncommitted change(s) to shipped code:\n\n` +
          `${list.join('\n')}\n\n` +
          `  worktree: ${cwd}\n\n` +
          `Nobody can tell afterwards what is in that artefact, and if another ` +
          `session owns those edits you would be shipping their unfinished work ` +
          `under your name. A rollback then has no known-good target.\n\n` +
          `Build from a commit instead — it takes one command and leaves every ` +
          `other tree untouched:\n` +
          `  git worktree add --detach /d/wt-build <commit>\n` +
          `  cp frontend/.env.production /d/wt-build/frontend/    # gitignored\n\n` +
          `Then build and upload from there.`
      )
    }
  }

  // Taking or refreshing the lock. Same session re-deploying just extends it.
  try {
    writeLock(cwd, {
      session,
      what: hit.name,
      worktree: cwd,
      at: new Date().toISOString(),
      command: command.slice(0, 160),
    })
  } catch {
    /* a lock we cannot write is not a reason to block a deploy */
  }
  allow()
}

main()
