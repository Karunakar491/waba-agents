#!/usr/bin/env node
/**
 * git-guard.js — PreToolUse hook on Bash/PowerShell.
 *
 * Blocks git commands that would discard uncommitted work.
 *
 * Written 2026-09-21 after a review subagent ran `git checkout <branch> -- .`
 * inside frontend/ and destroyed the uncommitted contents of two files. They
 * had never been staged, so git held no blob and nothing could be recovered.
 * The instruction it was given said "do not modify any files"; the instruction
 * was not the thing that failed, because an instruction is not a mechanism.
 *
 * The gate is precise rather than blunt: it denies only when the command would
 * actually destroy something. If nothing in the target paths is modified, the
 * same command is allowed through, so ordinary use is unaffected and the block
 * only ever appears when it is about to matter.
 *
 * It cannot protect what it cannot see. Committing early is still the only real
 * safety; this catches the case where that has not happened yet.
 */

const { execSync } = require('child_process')

// Commands that overwrite the working tree from some other source.
const DESTRUCTIVE = [
  // `git checkout -- .` / `git checkout <ref> -- <paths>` (but not branch switching)
  { re: /\bgit\s+(?:-C\s+\S+\s+)?checkout\b[^|;&]*\s--\s/, scope: 'paths', name: 'git checkout -- <paths>' },
  { re: /\bgit\s+(?:-C\s+\S+\s+)?restore\b/, scope: 'paths', name: 'git restore' },
  { re: /\bgit\s+(?:-C\s+\S+\s+)?reset\s+--hard\b/, scope: 'all', name: 'git reset --hard' },
  { re: /\bgit\s+(?:-C\s+\S+\s+)?clean\b[^|;&]*\s-[a-zA-Z]*f/, scope: 'all', name: 'git clean -f' },
  { re: /\bgit\s+(?:-C\s+\S+\s+)?stash\s+(?:drop|clear)\b/, scope: 'none', name: 'git stash drop/clear' },
]

/**
 * Remove heredoc bodies before matching.
 *
 * A heredoc is data on stdin, not a command: a commit message quoting
 * `git checkout <ref> -- .` must not be read as running it. This guard blocked
 * the very commit that introduced it for exactly that reason, which is a
 * decent argument that the check belongs here.
 */
function stripHeredocs(command) {
  return command.replace(
    /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*?^\2$/gm,
    '<<HEREDOC'
  )
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })
  )
  process.exit(0)
}

function allow() {
  process.exit(0)
}

function repoRoot() {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
  } catch {
    return process.cwd()
  }
}

/** Files with uncommitted changes. Untracked included: `clean -f` eats those too. */
function dirtyFiles(repo) {
  try {
    return execSync('git status --porcelain', { cwd: repo, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .map((l) => ({ status: l.slice(0, 2), file: l.slice(3).trim() }))
  } catch {
    return []
  }
}

/**
 * The paths a command targets.
 *
 * Two spellings: `checkout <ref> -- <paths>` puts them after the separator,
 * while `restore <paths>` takes them as bare positionals. Returning null means
 * "could not tell", and the caller then treats the whole tree as in scope, so
 * an unparsed command fails safe rather than silently open.
 *
 * Being wrong in the strict direction is not free: a guard that blocks a
 * command which would have destroyed nothing is a guard people switch off.
 */
function targetPaths(command) {
  const sep = command.indexOf(' -- ')
  const tail =
    sep !== -1
      ? command.slice(sep + 4)
      : (command.match(/\bgit\s+(?:-C\s+\S+\s+)?restore\s+(.*)$/) || [])[1]

  if (!tail) return null

  return tail
    .split(/[\s|;&]+/)
    .filter(Boolean)
    .filter((p) => !p.startsWith('-'))
}

function main() {
  let input = ''
  try {
    input = require('fs').readFileSync(0, 'utf8')
  } catch {
    allow()
  }

  let payload
  try {
    payload = JSON.parse(input)
  } catch {
    allow()
  }

  const command = payload?.tool_input?.command
  if (typeof command !== 'string') allow()

  const hit = DESTRUCTIVE.find((d) => d.re.test(stripHeredocs(command)))
  if (!hit) allow()

  const repo = repoRoot()
  const dirty = dirtyFiles(repo)

  // `stash drop`/`clear` destroys stashed work regardless of tree state.
  if (hit.scope === 'none') {
    deny(
      `BLOCKED — ${hit.name} permanently discards stashed work.\n\n` +
        'If this is deliberate, run it yourself outside the agent.'
    )
  }

  if (!dirty.length) allow() // nothing to lose

  let atRisk = dirty
  if (hit.scope === 'paths') {
    const paths = targetPaths(command)
    // `.` or an unparsable command means the whole tree is in scope.
    if (paths && paths.length && !paths.includes('.')) {
      atRisk = dirty.filter((d) => paths.some((p) => d.file.startsWith(p.replace(/^\.\//, ''))))
    }
  }

  if (!atRisk.length) allow()

  const list = atRisk.slice(0, 10).map((d) => `  ${d.status} ${d.file}`)
  if (atRisk.length > 10) list.push(`  … ${atRisk.length - 10} more`)

  deny(
    `BLOCKED — \`${hit.name}\` would discard uncommitted work in ` +
      `${atRisk.length} file(s):\n\n${list.join('\n')}\n\n` +
      'These changes are not staged, so git holds no copy and this is not ' +
      'recoverable.\n\n' +
      'If you need a clean checkout of another revision, use a worktree instead — ' +
      'it leaves this tree untouched:\n' +
      '  git worktree add /d/hwt <branch>\n\n' +
      'If you genuinely mean to throw this work away, commit it to a scratch ' +
      'branch first, or run the command yourself outside the agent.'
  )
}

main()
