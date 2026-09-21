#!/usr/bin/env node
/**
 * orient.js — print current reality, so the ORIENT beat is cheap enough to
 * always run.
 *
 * Answers, before any task starts:
 *   1. Does master match what is actually deployed?
 *   2. What work is sitting unmerged that this might duplicate or clobber?
 *   3. What job is open, and does it carry proof yet?
 *   4. What is the most broken thing, so a low-value task can be caught
 *      before it is started rather than after it ships.
 *
 * Read-only and OFFLINE. No SSH, no production calls, no network. Anything
 * needing a live host stays a deliberate, separate action — that boundary is
 * what keeps production data safe by construction, not by discipline.
 *
 * Every section fails soft: a missing file or a broken git repo degrades that
 * one line, never the run. A probe that refuses to start teaches people to
 * stop running it.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

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

function readState() {
  const file = path.join(REPO, 'STATE.md')
  if (!fs.existsSync(file)) return null
  return fs.readFileSync(file, 'utf8')
}

/** Lines under `## <heading>`, up to the next `##`, comments and blanks dropped. */
function section(body, heading) {
  if (!body) return []
  const lines = body.split('\n')
  const start = lines.findIndex((l) =>
    new RegExp(`^##\\s+${heading}\\b`, 'i').test(l)
  )
  if (start === -1) return []

  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => /^##\s/.test(l))
  return (end === -1 ? rest : rest.slice(0, end))
    .filter((l) => l.trim() && !/^\s*(<!--|>)/.test(l))
}

/** Markdown emphasis is noise in a terminal report. */
function plain(line) {
  return line.replace(/^[-*]\s*/, '').replace(/\*\*/g, '').replace(/`/g, '')
}

// ------------------------------------------------------------- deploy drift

function deployDrift(state) {
  console.log('DEPLOYED')

  let master
  try {
    master = git('rev-parse --short master')
  } catch {
    console.log('  ? could not read master (not a git repo, or no master branch)')
    return
  }

  // STATE.md records the live SHA as `- <surface>: <sha> — <when>`. Match a
  // 7-to-40 char hex run so both short and full SHAs are picked up.
  const live = section(state, 'Live')
  if (!live.length) {
    console.log(`  ? STATE.md has no Live section — master is ${master}`)
    return
  }

  let matched = false
  for (const line of live) {
    const sha = (line.match(/\b([0-9a-f]{7,40})\b/) || [])[1]
    if (!sha) {
      console.log(`  · ${plain(line)}`)
      continue
    }
    matched = true
    const same = master.startsWith(sha) || sha.startsWith(master)
    const mark = same ? 'OK' : '!!'
    const note = same ? '' : `  (master is ${master} — DRIFT)`
    console.log(`  ${mark} ${plain(line)}${note}`)
  }

  if (!matched) console.log(`  ? no SHA recorded in Live — master is ${master}`)
}

// -------------------------------------------------------- unmerged branches

function unmerged() {
  console.log('\nUNMERGED')

  let branches
  try {
    branches = git('for-each-ref --format=%(refname:short) refs/heads')
      .split('\n')
      .filter((b) => b && b !== 'master')
  } catch {
    console.log('  ? could not list branches')
    return
  }

  const ahead = []
  for (const branch of branches) {
    try {
      const n = Number(git(`rev-list --count master..${branch}`))
      if (n > 0) ahead.push({ branch, n })
    } catch {
      // Branch unreachable from master (orphan, or master missing). Skip it
      // rather than reporting a count we cannot compute.
    }
  }

  if (!ahead.length) {
    console.log('  OK nothing ahead of master')
    return
  }

  ahead.sort((a, b) => b.n - a.n)
  for (const { branch, n } of ahead) {
    console.log(`  !! ${branch} — ${n} commit${n === 1 ? '' : 's'} ahead of master`)
  }
}

// ---------------------------------------------------------------- open job

function openJob() {
  console.log('\nJOB')

  const pointer = path.join(REPO, '.jobs', 'current')
  if (!fs.existsSync(pointer)) {
    console.log('  · none — a commit will be blocked until one exists')
    return
  }

  const slug = fs.readFileSync(pointer, 'utf8').trim()
  if (!slug) {
    console.log('  !! .jobs/current is empty')
    return
  }

  const file = path.join(REPO, 'docs', 'jobs', `${slug}.md`)
  if (!fs.existsSync(file)) {
    console.log(`  !! .jobs/current names "${slug}" but docs/jobs/${slug}.md is missing`)
    return
  }

  const body = fs.readFileSync(file, 'utf8')
  // Mirror commit-gate.js: a section holding only template placeholders or
  // comments reads as empty, so an untouched template does not pass as proof.
  const proof = section(body, 'Proof').filter(
    (l) => !/^\s*(TBD|TODO|_?\[.*\]_?\s*$)/i.test(l)
  )

  console.log(`  · ${slug}`)
  console.log(
    proof.length
      ? '  OK Proof section is filled'
      : '  !! Proof section is empty — commit will be blocked'
  )
}

// -------------------------------------------------------------- top broken

function topBroken(state, limit = 3) {
  console.log('\nMOST BROKEN')

  const broken = section(state, 'Broken').filter((l) => /^\s*[-*]\s/.test(l))
  if (!broken.length) {
    console.log('  ? STATE.md has no Broken entries')
    return
  }

  for (const line of broken.slice(0, limit)) {
    console.log(`  ${plain(line.trim())}`)
  }
  if (broken.length > limit) {
    console.log(`  … ${broken.length - limit} more in STATE.md`)
  }
}

// ------------------------------------------------------------------- main

function main() {
  const state = readState()
  if (!state) {
    console.log('STATE.md not found at repo root — the ledger is the centre of')
    console.log('the loop. Create it before orienting.\n')
  }

  deployDrift(state)
  unmerged()
  openJob()
  topBroken(state)

  console.log('\nBefore acting: is this the most valuable thing open, what does')
  console.log('it touch, and what could it break?')
}

main()
