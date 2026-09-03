#!/usr/bin/env node
/**
 * Commit gate. Runs as a Claude Code PreToolUse hook on Bash/PowerShell.
 * Blocks `git commit` unless the change is tied to a job and carries proof.
 *
 * Three checks, in order:
 *   1. JOB    — .jobs/current names a job file in docs/jobs/ with a filled-in
 *               "Who / Deciding / Sees" line.
 *   2. PROOF  — that job file has a non-empty "## Proof" section.
 *   3. DIFF   — staged diff is within the 400-line cap, and contains none of
 *               the banned patterns (raw hex colors, TS `any`, raw ids in JSX).
 *
 * Escape hatch is visible, not silent: a job slug starting with "chore/"
 * skips the PROOF check. The slug is recorded in the job file either way.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Resolve the repo root, never process.cwd(): the hook inherits whatever
// directory the shell happens to be sitting in, so a prior `cd backend` made
// the gate look for .jobs/current in the wrong place and report "no active
// job" for a job that existed.
function repoRoot() {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
  } catch {
    return process.cwd()
  }
}

const REPO = repoRoot()
const DIFF_CAP = 400

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

function git(args) {
  return execSync(`git ${args}`, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

// ---------------------------------------------------------------- check 1: job

function readJob() {
  const pointer = path.join(REPO, '.jobs', 'current')
  if (!fs.existsSync(pointer)) {
    deny(
      'COMMIT BLOCKED — no active job.\n\n' +
        'Every change traces to a named job. Create one:\n' +
        '  1. Write docs/jobs/<slug>.md (copy docs/jobs/TEMPLATE.md)\n' +
        '  2. echo <slug> > .jobs/current\n\n' +
        'The job file must answer: who opens this, what are they deciding, ' +
        'what will they see that changes the decision.'
    )
  }

  const slug = fs.readFileSync(pointer, 'utf8').trim()
  if (!slug) deny('COMMIT BLOCKED — .jobs/current is empty. Write the job slug into it.')

  const jobFile = path.join(REPO, 'docs', 'jobs', `${slug}.md`)
  if (!fs.existsSync(jobFile)) {
    deny(`COMMIT BLOCKED — .jobs/current names "${slug}" but docs/jobs/${slug}.md does not exist.`)
  }

  return { slug, jobFile, body: fs.readFileSync(jobFile, 'utf8') }
}

function section(body, heading) {
  const lines = body.split('\n')
  const start = lines.findIndex((l) => new RegExp(`^##\\s+${heading}\\s*$`, 'i').test(l))
  if (start === -1) return null

  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => /^##\s/.test(l))
  const content = end === -1 ? rest : rest.slice(0, end)

  // Strip template placeholders and comments so an unfilled section reads empty.
  const filled = content
    .filter((l) => !/^\s*(<!--|>|TBD|TODO|_?\[.*\]_?\s*$)/i.test(l))
    .join('\n')
    .trim()

  return filled || null
}

// ------------------------------------------------------------- check 3: diff

const BANNED = [
  {
    name: 'hardcoded hex color',
    // #abc / #aabbcc inside a className or style string, in frontend source.
    files: /frontend[\\/].*\.(tsx|ts|css)$/,
    re: /#[0-9a-fA-F]{3,8}\b/,
    why: 'Use a design token from DESIGN.md, not a raw hex value.',
  },
  {
    name: 'TypeScript `any`',
    files: /\.(ts|tsx)$/,
    re: /:\s*any\b|<any>|as\s+any\b/,
    why: 'CLAUDE.md bans `any`. Type it properly.',
  },
  {
    name: 'raw internal id rendered in JSX',
    files: /frontend[\\/].*\.tsx$/,
    // Must be a rendered child, not an attribute value. `key={item.id}`,
    // `to={row.id}` and `value={agent.id}` are plumbing and always fine; only
    // `>{agent.id}<` puts the identifier in front of a human. Hence the
    // requirement that the brace NOT be preceded by `=` (attribute) or `$`
    // (template-literal interpolation, e.g. a route path).
    re: /(^|[^=$])\{\s*\w+\.(id|wabaId|phoneNumberId|agentId)\s*\}/,
    why:
      'A user-facing screen should not display an internal identifier. ' +
      'This is the AgentsPage.tsx:492 defect. If an operator genuinely needs ' +
      'the id, put it on a debug surface, not in a primary table cell.',
  },
]

function checkDiff() {
  let numstat
  try {
    numstat = git('diff --cached --numstat')
  } catch {
    deny('COMMIT BLOCKED — could not read the staged diff. Is anything staged?')
  }

  const rows = numstat.trim().split('\n').filter(Boolean)
  if (rows.length === 0) allow() // nothing staged; let git report it

  let total = 0
  const files = []
  for (const row of rows) {
    const [added, deleted, file] = row.split('\t')
    if (added !== '-' && deleted !== '-') total += Number(added) + Number(deleted)
    if (file) files.push(file)
  }

  if (total > DIFF_CAP) {
    deny(
      `COMMIT BLOCKED — staged diff is ${total} lines, cap is ${DIFF_CAP}.\n\n` +
        'A diff the reviewer cannot read in one sitting is a diff the reviewer ' +
        'cannot approve. Split it into smaller commits.'
    )
  }

  const hits = []
  for (const file of files) {
    let added
    try {
      added = git(`diff --cached -U0 -- "${file}"`)
    } catch {
      continue
    }
    const addedLines = added
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .map((l) => l.slice(1))

    for (const rule of BANNED) {
      if (!rule.files.test(file)) continue
      for (const line of addedLines) {
        if (rule.re.test(line)) {
          hits.push(`  ${file}\n    ${rule.name}: ${line.trim().slice(0, 100)}\n    → ${rule.why}`)
          break
        }
      }
    }
  }

  if (hits.length) {
    deny(`COMMIT BLOCKED — banned patterns in the staged diff:\n\n${hits.join('\n\n')}`)
  }
}

// ------------------------------------------------------------------- main

function main() {
  let input = ''
  try {
    input = fs.readFileSync(0, 'utf8')
  } catch {
    allow()
  }

  let payload
  try {
    payload = JSON.parse(input)
  } catch {
    allow()
  }

  const cmd = payload?.tool_input?.command ?? ''
  // Only gate real commits. `git commit --dry-run` and `git log` style reads pass.
  if (!/\bgit\s+(-\S+\s+)*commit\b/.test(cmd)) allow()
  if (/--dry-run/.test(cmd)) allow()

  const job = readJob()

  const framing = section(job.body, 'Job')
  if (!framing) {
    deny(
      `COMMIT BLOCKED — docs/jobs/${job.slug}.md has no filled-in "## Job" section.\n\n` +
        'Write one line: who opens this, what are they deciding, what will they ' +
        'see that changes the decision.'
    )
  }

  if (!job.slug.startsWith('chore/')) {
    const proof = section(job.body, 'Proof')
    if (!proof) {
      deny(
        `COMMIT BLOCKED — docs/jobs/${job.slug}.md has no filled-in "## Proof" section.\n\n` +
          'Proof is what you promised to show when the job was opened: a screenshot ' +
          'path, a real API response, a transcript from the running app. Not a ' +
          'description of the code.\n\n' +
          'If this commit genuinely produces nothing demonstrable (config, docs, ' +
          'scaffolding), rename the job slug to "chore/<slug>" — that skips this ' +
          'check and records the exemption in the ledger.'
      )
    }
  }

  checkDiff()
  allow()
}

main()
