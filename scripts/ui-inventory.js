#!/usr/bin/env node
/**
 * ui-inventory.js — generate docs/UI-INVENTORY.md.
 *
 * Every route, every control a user can press, and whether any e2e spec drives
 * it. Generated, never hand-written: a hand-maintained list of buttons is wrong
 * within a week and then quietly lies.
 *
 * Founder, 2026-09-21: "every button and every user experience should be
 * documented." The point is not the document. The point is being able to answer
 * "which buttons has nobody ever tested?" — which, before this existed, nobody
 * could.
 *
 * Coverage is matched on accessible name, because that is what the e2e suite
 * selects by. This repo has no data-testid anywhere and must keep it that way,
 * so a control with no accessible name is both untestable and unusable by a
 * screen reader. Those are reported as a defect, not skipped.
 *
 * Read-only and offline.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

function repoRoot() {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()
  } catch {
    return process.cwd()
  }
}

const REPO = repoRoot()
const SRC = path.join(REPO, 'frontend', 'src')
const E2E = path.join(REPO, 'frontend', 'e2e')
const OUT = path.join(REPO, 'docs', 'ui-inventory')

// The output is regenerated constantly and the commit gate caps a diff at 400
// lines, so it is split the same way the knowledge index is: by area, each file
// reviewable on its own, all of them greppable in one call.
function area(file) {
  const parts = rel(file).split('/') // frontend/src/<a>/<b>/...
  if (parts[2] === 'pages') return 'pages'
  if (parts[2] === 'components') return `components-${parts[3] || 'root'}`
  return parts[2] || 'root'
}

function walk(dir, ext, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, ext, acc)
    else if (ext.test(entry.name)) acc.push(full)
  }
  return acc
}

const rel = (f) => path.relative(REPO, f).replace(/\\/g, '/')

// ------------------------------------------------------------------ routes

function routes() {
  const app = path.join(SRC, 'App.tsx')
  if (!fs.existsSync(app)) return []
  const out = []
  for (const line of fs.readFileSync(app, 'utf8').split('\n')) {
    const m = /<Route\s+path="([^"]+)"\s+element=\{<(\w+)/.exec(line)
    if (m && !/Navigate/.test(line)) out.push({ path: m[1], component: m[2] })
  }
  return out
}

// ---------------------------------------------------------------- controls

/**
 * Controls a user can press, with the accessible name they are pressed by.
 *
 * Deliberately regex, not a parser: the goal is an inventory good enough to
 * find the untested buttons, and a wrong entry is cheap while a missing file is
 * not. Anything ambiguous is reported as unnamed rather than guessed at.
 */
/** End index of a JSX open tag starting at `<`, ignoring `>` inside braces/strings. */
function endOfOpenTag(text, start) {
  let depth = 0
  let quote = null
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === quote && text[i - 1] !== '\\') quote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '>' && depth === 0) return i
  }
  return -1
}

/**
 * The accessible name, in the order a browser resolves it: aria-label wins,
 * then the text child, then title. A name built from a template literal is
 * reported with its interpolations as `<…>` — the test has to match it with a
 * pattern, and saying so is more useful than pretending it is static.
 */
function accessibleName(attrs, children) {
  const aria =
    /aria-label=\{?[`"']([^`"']*)[`"']\}?/.exec(attrs) ||
    /aria-label=\{`([^`]*)`\}/.exec(attrs)
  if (aria) return aria[1].replace(/\$\{[^}]*\}/g, '<…>').replace(/\s+/g, ' ').trim()

  if (children) {
    // Strip nested elements, then expressions from the inside out — a single
    // pass leaves the outer half of `{a > 0 && (<X/>)}` behind as text.
    let text = children.replace(/<[^>]*>/g, ' ')
    let previous
    do {
      previous = text
      text = text.replace(/\{[^{}]*\}/g, ' ')
    } while (text !== previous)
    text = text.replace(/\s+/g, ' ').trim()
    if (text) return text
  }

  const title = /title=\{?[`"']([^`"']*)[`"']\}?/.exec(attrs)
  if (title) return title[1].replace(/\$\{[^}]*\}/g, '<…>').trim()

  return null
}

function controls(file) {
  const text = fs.readFileSync(file, 'utf8')
  const found = []

  for (const m of text.matchAll(/<(button|Button|Link|a)\b/g)) {
    const tag = m[1]
    const open = m.index
    const gt = endOfOpenTag(text, open)
    if (gt === -1) continue

    const attrs = text.slice(open, gt)
    if (/\bhidden\b/.test(attrs)) continue

    let children = ''
    if (text[gt - 1] !== '/') {
      const close = text.indexOf(`</${tag}>`, gt)
      if (close !== -1 && close - gt < 4000) children = text.slice(gt + 1, close)
    }

    const name = accessibleName(attrs, children)
    const icon = (/<([A-Z]\w+)/.exec(children) || [])[1]
    found.push({ kind: tag.toLowerCase(), name, icon })
  }

  const seen = new Set()
  return found.filter((c) => {
    if (!c.name) return true
    if (c.name.length > 80) return false
    const key = `${c.kind}:${c.name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ---------------------------------------------------------------- coverage

/** Accessible names the e2e suite actually drives, and which spec drives them. */
function covered() {
  const map = new Map()
  for (const spec of walk(E2E, /\.spec\.ts$/)) {
    const text = fs.readFileSync(spec, 'utf8')
    for (const m of text.matchAll(/getBy(?:Role|Label|Text)\(\s*(?:['"`](\w+)['"`]\s*,\s*)?\{[^}]*name:\s*['"`]([^'"`]+)['"`]/g)) {
      const name = m[2]
      if (!map.has(name)) map.set(name, new Set())
      map.get(name).add(path.basename(spec))
    }
    for (const m of text.matchAll(/getBy(?:Text|Label)\(\s*['"`]([^'"`]+)['"`]/g)) {
      const name = m[1]
      if (!map.has(name)) map.set(name, new Set())
      map.get(name).add(path.basename(spec))
    }
  }
  return map
}

// ------------------------------------------------------------------- main

function main() {
  const routeList = routes()
  const cover = covered()
  const files = walk(SRC, /\.tsx$/).sort()

  const byFile = []
  let totalControls = 0
  let totalCovered = 0
  let totalUnnamed = 0

  for (const file of files) {
    const list = controls(file)
    if (!list.length) continue
    const named = list.filter((c) => c.name)
    const unnamed = list.filter((c) => !c.name)
    totalControls += named.length
    totalUnnamed += unnamed.length
    for (const c of named) if (cover.has(c.name)) totalCovered++
    byFile.push({ file, named, unnamed })
  }

  const pct = totalControls ? Math.round((totalCovered / totalControls) * 100) : 0

  const preamble = [
    '**Generated — do not edit.** Run `node scripts/ui-inventory.js`.',
    '',
    'Coverage is matched on accessible name, because that is what the e2e suite',
    'selects by (this repo has no `data-testid` and must keep it that way). A control',
    'with no accessible name is listed as a defect: it cannot be tested by name, and a',
    'screen reader cannot announce it.',
    '',
    'To find a control, grep this directory for its on-screen label.',
    '',
  ]

  fs.mkdirSync(OUT, { recursive: true })
  for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f))

  // README: the numbers, the routes, and the uncovered list — the page to read
  // when the question is "what has nobody tested?"
  const readme = ['# UI inventory', '', ...preamble]
  readme.push(`- **${routeList.length}** routes`)
  readme.push(`- **${totalControls}** named controls, **${totalCovered}** driven by a test (**${pct}%**)`)
  readme.push(`- **${totalUnnamed}** controls with no accessible name`)
  readme.push('')
  readme.push('## Routes')
  readme.push('')
  readme.push('| Path | Screen |')
  readme.push('|---|---|')
  for (const r of routeList) readme.push(`| \`${r.path}\` | ${r.component} |`)
  readme.push('')
  readme.push('## By area')
  readme.push('')
  readme.push('| Area | Controls | Covered | Unnamed |')
  readme.push('|---|---|---|---|')

  const groups = {}
  for (const entry of byFile) (groups[area(entry.file)] ||= []).push(entry)

  for (const [name, entries] of Object.entries(groups).sort()) {
    const n = entries.reduce((s, e) => s + e.named.length, 0)
    const c = entries.reduce(
      (s, e) => s + e.named.filter((x) => cover.has(x.name)).length,
      0
    )
    const u = entries.reduce((s, e) => s + e.unnamed.length, 0)
    readme.push(`| [${name}](${name}.md) | ${n} | ${c} | ${u} |`)

    const body = [`# UI inventory: ${name}`, '', ...preamble]
    for (const { file, named, unnamed } of entries) {
      body.push(`## ${rel(file)}`)
      body.push('')
      if (named.length) {
        body.push('| Control | Name | Covered by |')
        body.push('|---|---|---|')
        for (const ctl of named) {
          const specs = cover.get(ctl.name)
          body.push(
            `| ${ctl.kind} | ${ctl.name.replace(/\|/g, '\\|')} | ${specs ? [...specs].join(', ') : '**—**'} |`
          )
        }
        body.push('')
      }
      if (unnamed.length) {
        const icons = [...new Set(unnamed.map((x) => x.icon).filter(Boolean))]
        body.push(
          `> **${unnamed.length} control(s) here have no accessible name**` +
            (icons.length ? ` (icon-only: ${icons.join(', ')})` : '') +
            '. Untestable by name, and a screen reader cannot announce them.'
        )
        body.push('')
      }
    }
    fs.writeFileSync(path.join(OUT, `${name}.md`), body.join('\n') + '\n')
  }

  fs.writeFileSync(path.join(OUT, 'README.md'), readme.join('\n') + '\n')

  console.log(`${rel(OUT)}/ written — ${Object.keys(groups).length} area files`)
  console.log(`  ${routeList.length} routes`)
  console.log(`  ${totalControls} named controls, ${totalCovered} covered (${pct}%)`)
  console.log(`  ${totalUnnamed} with no accessible name`)
}

main()
