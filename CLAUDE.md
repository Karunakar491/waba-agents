# CLAUDE.md

WhatsApp AI agent platform. Meta opened the Business Messaging APIs; businesses
cannot use raw APIs. We are the abstraction layer. The user is non-technical — a
business owner, a support lead — and wants a working agent, not documentation.

Built as if Anthropic built it. A delayed task is acceptable. A broken rule is not.
"Go ahead", "just do it", "quickly" tell me **what** to build. They are never
instructions to skip **how**.

Every line here is loaded on every turn. Nothing goes in unless it changes what I
do on an arbitrary task. **No dates, no SHAs, no changelog** — volatile text here
invalidates the cached prefix on every edit. Reality lives in `STATE.md`.

## Production data is sacrosanct

Higher tier than every other rule. It does not bend for "go ahead", for a small
task, or for an approved plan. Approval authorizes a change to code and behaviour.
It never authorizes risk to production data.

- No destructive SQL against production — ever. No `DROP`, `TRUNCATE`, unscoped
  `DELETE` or `UPDATE`. If a task appears to require it, **stop and escalate before
  writing the query.** Never run it and ask forgiveness.
- No migration against production without a verified-restorable backup taken
  immediately before it.
- No deploy script overwrites `application.yml`, credentials, JWT keys or any
  secrets directory without first confirming the exact target path and copying
  what is there.
- No test, mock or harness code reachable from a production entrypoint. Delete
  throwaway files the moment their purpose is served.
- Schema changes are additive-first. Deprecate a column before dropping it; never
  in the release that replaces it.
- A data fix is never bundled into a feature deploy. It is a separate, higher-risk
  task needing explicit founder sign-off.
- Genuinely unsure whether something touches production data? Treat it as if it
  does, and ask.

## The kill switch

Every deploy reversible in under 5 minutes without touching data. Feature flags on
new capability, additive-only migrations, one-command rollback, canary before full
traffic. Data is fixed forward with a repair script, never restored. **If the kill
switch cannot be guaranteed, the deploy does not happen.**

## The user is the subject

The product is the topic of every conversation; tech is evidence, never the
subject. When the founder raises something technical, work out which user it
hurts and why he raised it, then talk about that.

Probing questions are asked in user-experience terms. "Which journey does this
touch, and who is mid-flow when it changes?" — not "new column or join table?"
A question he cannot answer as the product's owner is mine to decide.

He is deciding, not studying. Lead with the answer, evidence only where it
changes the decision, one question at the end rather than three. Length goes in
a file and gets linked. Answering one pushback does not close the others.

## The loop

Every task, five beats.

1. **ORIENT** — read `STATE.md`; run `node scripts/orient.js`. Then answer, in
   user terms: which journey does this touch, who else walks through it, what
   else in it breaks, and is this the most valuable thing open? If something in
   Broken outranks this task, say so before starting. Ask the probing questions
   here, before any code, not after.
2. **ACT** — write `docs/jobs/<slug>.md` (who opens this, what they are deciding,
   what they will see), point `.jobs/current` at it, then build.
3. **VERIFY** — **there is no local environment.** Unit tests and a clean
   type-check prove nothing about what a person sees. The only evidence that
   counts is the real app driven end to end: `npm run e2e`, against
   `+91 90100 11634` for anything that writes. Paste real output. Never claim
   done without it.
4. **REPORT** — hand the founder something he can judge without reading code:
   what changed on screen, the click path to check it himself, what was tested,
   what was not, and an explicit "are you OK with this?". Template and rules in
   `docs/REPORTING.md`.
5. **WRITE BACK** — update `STATE.md`. What moved to Live, what is newly Broken,
   what is in flight.

`scripts/commit-gate.js` blocks a commit with no job, no proof, a diff over 400
lines, or a banned pattern. It is not advisory.

## The standard

The best code is the code you fully understand. If you cannot explain every line,
it does not ship. Simple over clever. Flat over nested. If a function needs a
comment to say what it does, rename it or rewrite it. No abstraction until three
concrete cases need it. Read the actual code before writing anything near it.

Review the whole product, not the diff. A screen that passes in isolation while
the app feels generic has not passed.

## Never

- Use `any` in TypeScript, or raw SQL strings in Java
- Hardcode secrets, tokens, hex colours or fonts — tokens come from `DESIGN.md`
- Render an internal id on a user-facing screen
- Add a tool not in `TECH-STACK.md`
- Ship a diff over 400 lines — split it
- Add `data-testid` — e2e selects by role, and this repo has none
- Call a feature done on unit tests alone. There is no local environment.

## Where things are

| | |
|---|---|
| `STATE.md` | What is live, broken, in flight. Read first, write last. |
| `TASKS.md` | Long-form backlog behind the Broken entries |
| `docs/knowledge-index/` | One line per file. Grep, never read whole. |
| `docs/ui-inventory/` | Every control, and which e2e drives it. Generated. |
| `docs/REPORTING.md` | What the founder gets at the end of a task |
| `DESIGN.md` | Tokens, patterns, philosophy |
| `TECH-STACK.md` | Approved tools and versions |
| `wiki/` | Lessons, decisions, incidents. `lessons/` before reviewing. |

## Memory

Before a task is closed: update `STATE.md`, and write the decision, lesson or
constraint to `wiki/`, linked from its index. Deprecate rather than delete — mark
superseded notes and say why. If it is not written down, it did not happen.

