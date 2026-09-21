#!/usr/bin/env node
/**
 * Tests for git-guard.js. Run: node scripts/git-guard.test.js
 *
 * Self-contained: it creates its own untracked scratch file so the "would
 * destroy something" cases are deterministic, then removes it. An earlier
 * version asserted DENY while relying on the repo happening to be dirty, and
 * duly reported three false failures the first time it ran in a clean worktree.
 *
 * Command strings are assembled from fragments so this file's own text cannot
 * match the patterns it is testing.
 */

const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const CHECKOUT = ['git', 'check' + 'out'].join(' ')
const RESTORE = ['git', 're' + 'store'].join(' ')
const RESET_HARD = ['git', 're' + 'set', '--hard'].join(' ')
const CLEAN = ['git', 'cl' + 'ean', '-fd'].join(' ')
const STASH_DROP = ['git', 'st' + 'ash', 'drop'].join(' ')
const SEP = ' -' + '- '

const SCRATCH = path.join(__dirname, '..', '.git-guard-test-scratch')

function run(command) {
  let out = ''
  try {
    out = execFileSync('node', [path.join(__dirname, 'git-guard.js')], {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
      encoding: 'utf8',
    })
  } catch (e) {
    out = e.stdout || ''
  }
  return out.trim() ? 'DENY' : 'ALLOW'
}

const heredocQuotingTheCommand = [
  "git commit -q -F - <<'EOF'",
  'A message that quotes the damaging command:',
  `  ${CHECKOUT} some-branch${SEP}.`,
  'It is data on stdin, not a command.',
  'EOF',
].join('\n')

const realCommandAfterHeredoc = [
  "git commit -q -F - <<'EOF'",
  'a message',
  'EOF',
  CLEAN,
].join('\n')

const cases = [
  // Destructive, with something to lose.
  ['path-scoped checkout of everything', `${CHECKOUT} some-branch${SEP}.`, 'DENY'],
  ['hard reset', `${RESET_HARD} origin/master`, 'DENY'],
  ['forced clean', CLEAN, 'DENY'],
  ['dropping a stash', STASH_DROP, 'DENY'],
  ['restore of the dirty path', `${RESTORE} ${path.basename(SCRATCH)}`, 'DENY'],

  // Destructive in shape, but nothing at risk. A guard that cries wolf is a
  // guard that gets switched off.
  ['restore of an unmodified path', `${RESTORE} DESIGN.md`, 'ALLOW'],

  // Not destructive at all.
  ['branch switch', `${CHECKOUT} master`, 'ALLOW'],
  ['a diff', 'git diff master...some-branch', 'ALLOW'],
  ['an unrelated command', 'npm run build', 'ALLOW'],

  // Heredoc bodies are data, not commands.
  ['heredoc quoting the command', heredocQuotingTheCommand, 'ALLOW'],
  ['real command after a heredoc', realCommandAfterHeredoc, 'DENY'],
]

fs.writeFileSync(SCRATCH, 'scratch file so the destructive cases have a victim\n')

let failures = 0
try {
  for (const [name, command, expected] of cases) {
    const actual = run(command)
    const ok = actual === expected
    if (!ok) failures++
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${actual.padEnd(5)} ${name}`)
  }
} finally {
  fs.unlinkSync(SCRATCH)
}

console.log(failures ? `\n${failures} of ${cases.length} FAILED` : `\nall ${cases.length} as expected`)
process.exit(failures ? 1 : 0)
