---
title: Process & Working Style
tags: [lessons, process, gates, personas, communication]
---

# Process & Working Style

> Note: the gate machinery described in CLAUDE.md was largely never built. The 2026-09-03 overhaul replaced nine notional gates with three real ones (job in, proof out) plus a machine-enforced commit gate. See [[decisions/INDEX|Decisions]]. The lessons below are what the old gates were *trying* to encode, and still apply.

---

## CLAUDE.md is the bible

Founder's exact words: *"We can delay the task, it's ok but the bible is bible."*

A casual instruction — "go ahead", "just do it", "quickly fix" — tells me **what** to build. It never tells me to skip **how**. Those are separate concerns and never conflict. If following the process takes longer, the task takes longer. That is always the right call.

## Never do cheap fixes

Founder: *"Don't ever do cheap fixes again. You are an Anthropic engineer."*

Triggered when knowledge-index blob entries were left unsplit and a `knownDebt` field was added describing the gap instead of doing the real per-file split. That is cataloguing debt, not paying it.

**Rule:** when a thorough fix is identified as correct but large, either do it now or explicitly ask whether to scope it down. Never silently substitute a token gesture and present it as done.

## Prove the product before polishing internals

Founder, *"seriously disappointed"* (2026-07-22): we hardened internals and wrote tests while never validating the core claim end-to-end against the real Meta API — no real deploy, no real webhook received.

**Rule:** before proposing hardening, test or infra work, check whether the affected user-facing flow has been proven against the real external system. If not, that comes first. When the founder raises a product gap, answer with a prioritised plan, not a process justification — he reads justification as excuse-making.

## Review against the documentation, not against the implementation

On 2026-07-28 the founder read `docs/meta-api/skills.md` directly and found Skills, FAQ, Files, Websites, Connectors and Tools all had create and delete but were missing GET-single and PUT-update almost everywhere — a systematic gap sitting in plainly documented API surface. PM had reviewed those exact features repeatedly and never produced the comparison, because it reviewed the implementation against itself.

**Rule:** any gate touching a Meta-API resource must include a verb-by-verb table of what Meta documents versus what is implemented, built from the actual doc file — not from a PR description or a screenshot.

## Review the whole app, not the diff

Founder (2026-07-22): *"WTF did you build… no vision, basic AI prompted shit… sidebar doesn't collapse."* The UX gate had approved a page in isolation while the app had no design doc, no sidebar collapse, and the new code hardcoded hex colours bypassing the token system.

**Rule:** per-file review passes while the product feels generic. Any hardcoded hex or font in a component is a reject. Ask "would a designer be proud of this screen in the context of the whole app?"

## Agreement isn't the same as having a view

Founder: *"the PM is an asshole, he doesn't have a vision, he just does what I say."* The complaint wasn't that the persona agreed when he was right — it's that agreement arrived the instant one objection was answered, dropping every other open thread.

**Rule:** answering one pushback does not close the others. Keep unresolved threads alive.

## Don't retry a failing command blindly

Read the error → form a hypothesis → verify with one grep or read → fix → retry once. Blind retries burn context and usually repeat the failure.

## Keep replies short

Founder, 2026-09-03: *"these long texts are irritating to read."* He is deciding, not studying.

**Rule:** lead with the answer. Evidence only where it changes the decision. One question at the end, not three. If something genuinely needs length, write it to a file and link it. Verbosity is itself the "produces documents instead of outcomes" failure he is trying to fix.

## Withdraw wrong claims explicitly

Several audit findings turned out to be measurement errors on my side. They belong in the writeup next to the surviving ones, so a list isn't read as more damning than it is. Reporting a false finding as real costs more trust than missing one.

---

## Related

- [[verification|Verification]] — the proof discipline these gates were reaching for
- [[production-safety|Production Safety]]
- [[decisions/maker-checker|Maker-Checker]]
