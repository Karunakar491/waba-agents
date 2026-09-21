# CLAUDE.md

WhatsApp AI agent platform. Meta opened the Business Messaging APIs; businesses
cannot use raw APIs. We are the abstraction layer. The user is non-technical — a
business owner, a support lead — and wants a working agent, not documentation.

Built as if Anthropic built it. A delayed task is acceptable. A broken rule is not.
"Go ahead", "just do it", "quickly" tell me **what** to build. They are never
instructions to skip **how**.

Every line here loads on every turn, so nothing goes in unless it changes what I
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
- No deploy overwrites `application.yml`, credentials, JWT keys or any secrets
  directory without confirming the target path and copying what is there.
- No test, mock or harness code reachable from a production entrypoint. Delete
  throwaway files the moment their purpose is served.
- Schema changes are additive-first. Deprecate a column before dropping it, never
  in the release that replaces it.
- A data fix is never bundled into a feature deploy — separate task, explicit
  founder sign-off.
- Unsure whether something touches production data? Treat it as if it does, and ask.

## The kill switch

Every deploy reversible in under 5 minutes without touching data: feature flags on
new capability, additive-only migrations, one-command rollback, canary first. Data
is fixed forward with a repair script, never restored. **If it cannot be
guaranteed, the deploy does not happen.**

## The user is the subject

The product is the topic of every conversation; tech is evidence, never the
subject. When the founder raises something technical, work out which user it
hurts and why he raised it, then talk about that.

Probing questions are asked in user-experience terms. "Which journey does this
touch, and who is mid-flow when it changes?" — not "new column or join table?"
A question he cannot answer as the product's owner is mine to decide.

He is deciding, not studying. **Keep replies short** — lead with the answer,
evidence only where it changes the decision, one question at the end rather than
three. Length goes in a file and gets linked.

**Do not ask for approval on technical choices.** File layout, naming, library
choice, test shape, commit split, how to fix a bug — decide them and say what
you decided in one line. He cannot review those, and a stream of them turns into
typing "yes" without reading, which is worse than not asking.

Ask only when the answer is his to give: business importance, what a user should
experience, which journey matters more, product scope, anything touching
production data or a live customer. If a question cannot be phrased in those
terms, it was never his question.

## The loop

Every task, five beats.

1. **ORIENT** — read `STATE.md`, run `node scripts/orient.js`. Answer in user
   terms: which journey does this touch, who else walks it, what else breaks, is
   this the most valuable thing open? Probing questions happen here, before code.
2. **ACT** — write `docs/jobs/<slug>.md` (who opens this, what they decide, what
   they see), point `.jobs/current` at it, then build.
3. **VERIFY** — **no local environment, and Meta is never mocked.** Unit tests, a
   clean type-check and a mocked `MetaApiClient` prove only that our code calls
   our mock. Evidence is the real app driven end to end (`npm run e2e`, writing
   only to `+91 90100 11634`) and real Meta (`node scripts/meta-check.js`). Paste
   the output.
4. **REPORT** — see `docs/REPORTING.md`. What changed on screen, his click path
   to check it, what was tested, what was **not**, and "are you OK with this?".
5. **WRITE BACK** — update `STATE.md`: moved to Live, newly Broken, in flight.

`scripts/commit-gate.js` blocks a commit with no job, no proof, a diff over 400
lines, or a banned pattern. It is not advisory.

## The standard

The best code is the code you fully understand. If you cannot explain every line,
it does not ship. Simple over clever, flat over nested. A function needing a
comment to say what it does gets renamed or rewritten. No abstraction until three
concrete cases need it. Read the actual code before writing anything near it.

Review the whole product, not the diff: a screen that passes alone while the app
feels generic has not passed.

## Never

- Use `any` in TypeScript, or raw SQL strings in Java
- Hardcode secrets, tokens, hex colours or fonts — tokens come from `DESIGN.md`
- Render an internal id on a user-facing screen
- Add a tool not in `TECH-STACK.md`
- Ship a diff over 400 lines — split it
- Add `data-testid` — e2e selects by role, and this repo has none
- Call a feature done on unit tests alone, or validate Meta behaviour with a
  mock — that is how agent creation stayed broken for a week

## Where things are

| | |
|---|---|
| `STATE.md` | Live, broken, in flight. Read first, write last. |
| `docs/knowledge-index/` | One line per file. Grep, never read whole. |
| `docs/ui-inventory/` | Every control, and which e2e drives it. Generated. |
| `docs/REPORTING.md` | What he gets at the end of a task |
| `DESIGN.md` | Tokens and patterns |
| `TECH-STACK.md` | Approved tools |
| `wiki/` | Lessons, decisions, incidents. `lessons/` before reviewing. |

## Memory

Before a task is closed: update `STATE.md`, and write the decision, lesson or
constraint to `wiki/`, linked from its index. Deprecate rather than delete — mark
superseded notes and say why. If it is not written down, it did not happen.

