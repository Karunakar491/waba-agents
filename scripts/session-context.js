#!/usr/bin/env node
/**
 * session-context.js — SessionStart hook.
 *
 * Injects the ledger at the top of every session, so reality arrives without
 * anyone remembering to load it. Memory that has to be fetched by hand is
 * memory that is usually not fetched: that is how a job got opened to reorder
 * Inbox rows while no human could reply in the Inbox at all.
 *
 * Emits the whole of STATE.md when it is small enough to be cheap, and the
 * ranked head of it when it is not. Read-only and offline.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Above this, inject the ranked head rather than the whole file. The ledger is
// meant to stay an index; if it outgrows this it has become an archive, and the
// truncation notice is the signal to prune it back.
const FULL_INJECT_LINE_CAP = 120

function repoRoot() {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
  } catch {
    return process.cwd()
  }
}

/** Never fail a session start. A hook that breaks startup gets deleted. */
function emit(context) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: context,
      },
    })
  )
  process.exit(0)
}

function main() {
  const repo = repoRoot()
  const file = path.join(repo, 'STATE.md')

  if (!fs.existsSync(file)) {
    emit(
      'STATE.md is missing from the repo root. It is the centre of the loop — ' +
        'what is live, what is broken, what is in flight. Recreate it before ' +
        'starting work.'
    )
  }

  let body
  try {
    body = fs.readFileSync(file, 'utf8')
  } catch (err) {
    emit(`STATE.md could not be read (${err.message}). Check it before starting work.`)
  }

  const lines = body.split('\n')
  const truncated = lines.length > FULL_INJECT_LINE_CAP

  const ledger = truncated
    ? lines.slice(0, FULL_INJECT_LINE_CAP).join('\n') +
      `\n\n<!-- truncated at ${FULL_INJECT_LINE_CAP} lines. STATE.md has grown ` +
      `into an archive; prune it back to an index. Read the file for the rest. -->`
    : body

  emit(
    [
      '# Current state of the product (injected from STATE.md)',
      '',
      'This is the ledger. Read it before starting anything, write to it before',
      'closing anything. Run `node scripts/orient.js` for the measured parts.',
      '',
      'Before acting on any task, answer: is this the most valuable thing open,',
      'what does it touch, and what could it break?',
      '',
      '---',
      '',
      ledger,
    ].join('\n')
  )
}

main()
