# Keep Meta's own pages, not just our reading of them

## Job

Anyone arguing about what Meta accepts opens one file and reads Meta's words on
a dated page, instead of trusting a summary somebody wrote from it. Where the
two disagree, the source wins and the summary gets fixed.

Founder, 2026-09-24, supplying both pages: *"Please add both of them into the
documentation"*.

## Proof

Two source files added, verbatim apart from the per-endpoint error tables that
repeat identically on every endpoint (recorded once at the bottom of each, and
the trim is stated in the file):

- `docs/meta-api/sources/2026-09-24-skills-official.md`
- `docs/meta-api/sources/2026-09-24-ui-skills-official.md`

Both checked against our working summaries on arrival. **The summaries matched
on every normative point**, so nothing needed correcting:

| Checked | skills.md | ui-skills.md |
|---|---|---|
| Field names, types, limits | matches | matches |
| Title format rule | matches | n/a |
| `status` enum and meaning | matches (`active`/`pending_review`/`blocked`) | matches (`enabled`/`disabled`) |
| PUT semantics | matches (partial) | matches (title/status/instruction only) |
| Pagination | n/a | matches (`before`/`after`/`limit`, stop on absent `next`) |
| `flow_id` rule | n/a | matches (required for `flow`, rejected otherwise) |
| Component types | n/a | matches (all nine) |
| `metadata` | matches | n/a |

Linked from both summaries and from `docs/meta-api/INDEX.md`.

### Not done

- No code changed. The gaps between Meta's spec and our implementation are
  listed below and none is fixed.
- The other 21 files in `docs/meta-api/` have no source file — only these two
  were supplied.

## Where our implementation still diverges from these two pages

**Skills**

1. **`status` is never read.** `active` / `pending_review` / `blocked`. A
   blocked skill failed Meta's content review and **the agent never applies
   it**, and nothing in our product says so — it looks saved and fine. We do
   have a `status` on skills, but ours means `published`/`draft`, so the screen
   shows a word that means something else entirely.
2. **Our PUT is a full replace; Meta's is partial.** Harmless today because our
   editor shows all three fields, but it is the same shape as the bug that
   blanked a live business profile this morning.
3. **`metadata` is never sent or read.**

**UI skills**

4. **We never list from Meta** — `getUiSkills` reads our local mirror only. A
   UI skill created anywhere else is invisible to us, and Meta's pagination has
   therefore never been exercised.
5. **Our PUT sends `componentType`**, which Meta's update request does not
   accept.
6. `flow` and `flow_id` are deliberately excluded — Flows are out of scope.

## Notes

- The trim is the only editorial act: six identical error tables per page, kept
  once. Everything normative is verbatim.
- This is the rule I wrote this morning and should have followed then: fetch to
  refresh, keep a paste when it is evidence.
