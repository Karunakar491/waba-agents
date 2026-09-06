# Apple's design principles, mapped to this product

A standing reference, not a dated audit. Each of Apple's documented principles,
what it means for a SaaS product like ours, where we stand, and what is missing.

Apple's set is small and stable: **six Human Interface Guidelines principles**
(aesthetic integrity, consistency, direct manipulation, feedback, metaphors,
user control), the **three design themes** (clarity, deference, depth), and
**accessibility**, which Apple treats as a requirement rather than a principle.

Evidence is counted from the source tree and from a logged-in walk of all 19
screens against production on 2026-09-06. Verdicts here should be re-checked
when the numbers change.

---

## 1. Feedback

> **Apple:** "Feedback acknowledges actions and shows results to keep people
> informed." Every action produces a perceptible result.

**For us:** saving a skill, publishing a persona, deploying a connector,
deleting an agent — each should visibly confirm what happened.

**Where we stand:** **77 mutations. One visible success confirmation**
(`BusinessProfileTab.tsx:155`, "Published!"). `ErrorBanner` appears in 42 files
with real sentences, so failure is communicated well.

**What's lacking:**

- No confirmation mechanism exists at all — no toast, snackbar, or status
  region. This is missing infrastructure, not a missing polish pass.
- The consequence is worse than the omission: users learn that **silence means
  nothing happened**, so a genuinely dead control is indistinguishable from a
  working one. The Disconnect button on the agent page (empty handler,
  `AgentDetailPage.tsx:2158`) is invisible precisely because every working
  button behaves the same way.

**Fix:** one shared confirmation component, used by every mutation. Name what
happened and to what — "Skill saved", "Persona published to +91 91520 04195".

**Verdict: fails.** The single highest-leverage gap in the product.

---

## 2. User control

> **Apple:** "People — not apps — are in control." Apps suggest; people decide.
> Destructive actions are confirmed, and reversible where possible.

**For us:** nothing goes live on a real WhatsApp number without a deliberate
act, and anything consequential is recoverable or at least confirmed.

**Where we stand — genuinely good:**

- Nothing auto-deploys. Editing a library item explicitly does not reach into a
  running agent.
- The agent delete modal names every teardown step and reports what Meta did
  *not* clean up.
- The persona publish modal names the number and states that customers see the
  change immediately.

**What's lacking:**

- **No undo anywhere.** Zero occurrences in the codebase, against actions that
  reach live customers.
- **Confirmation is uneven**, which is worse than absent because it teaches a
  false habit:

  | Action | Confirms? |
  |---|---|
  | Delete agent | Yes — typed confirmation + per-step report |
  | Delete skill / file / website | Yes |
  | Disconnect WABA | Yes |
  | **Delete connector** | **No** |
  | **Delete connector action** | **No** |

- The 7-step agent wizard's step rail is **not clickable** — at step 6 you
  cannot jump to step 2 to fix one field. The app is driving.

**Fix:** confirm every delete. Make the step rail navigable. Add undo where the
underlying action allows it (drafts, library edits) and say plainly where it
does not (anything already on Meta).

**Verdict: fails** on forgiveness; passes on deliberateness.

---

## 3. Consistency

> **Apple:** "People are comfortable with interfaces that adopt standards and
> paradigms they know." The same thing is called the same name and behaves the
> same way throughout.

**For us:** one word per concept, one editing pattern, one place each kind of
thing lives.

**Where we stand:** the visual system is enforced tightly — **zero raw hex
colours** in any `.tsx`; everything goes through design tokens. Status is always
`StatusIndicator`. The Filters pattern (one button, one grouped panel) is used
on every library screen.

**What's lacking — the language:**

One act, *make this real on Meta*, is called at least five things:
`Add` (105 uses) · `Deploy` (80) · `Create` (47) · `Save` (42) ·
`Publish` (19), plus `Publish changes`, `Save draft`, `Save changes`,
`Publish handoff`, `Deploy now`.

On the Connectors row, **Publish and Deploy sit next to each other** doing
genuinely different things, and nothing on screen distinguishes them.

**And the interaction patterns:** editing opens a full page (Skills,
Connectors), an inline panel (Persona), or a modal, depending on the screen.

**Fix:** two verbs — **Save** for "keep this" and **Publish** for "make it real
on Meta". Retire Add, Create and Deploy as synonyms. One editing pattern: the
thing's own page.

**Verdict: fails** on language, **passes** on the visual system.

---

## 4. Clarity

> **Apple:** "Text is legible at every size, icons are precise and lucid,
> adornments are subtle and appropriate, and a sharpened focus on functionality
> motivates the design."

**For us:** every label says what will happen, in the operator's words.

**Where we stand — a real strength.** The copy is better than most internal
tools:

- "Disabling stops the agent on every existing conversation. Re-enabling only
  resumes new conversations — not the ones that went quiet."
- "Nothing is sent to Meta or Karix until you save a mapping."
- Status reads "Live" and "Not set up", not `active` and `draft`.

**What's lacking:**

- **A number that lies.** Reports shows "Success rate 0%", defined underneath as
  "closed without a human handoff". No conversation can ever close, so it is 0%
  permanently. Perfectly clear and completely false.
- **Unexplained distinctions.** Skills rows show "View" on some and "Edit" on
  others with no stated reason. Persona offers "Edit as new draft" without
  saying why the live one cannot be edited.
- **Duplicate rows with no distinguishing column.** The Skills library shows
  `intent-router` nine times, `quick-reply-pills` six — the same skill on
  different agents. `agentName` is already returned by the API and simply is not
  rendered.

**Fix:** hide any metric that cannot yet be true. State the reason beside every
restricted action. Add the agent column to Skills.

**Verdict: mixed** — excellent writing, undermined by a lying metric.

---

## 5. Recognition over recall

> **Apple:** minimise memory load — "make information visible" rather than
> asking people to remember it.

**For us:** never print an identifier where a human label belongs.

**What's lacking:**

- Knowledge Base upload picker: `smsa (1249896194867775)`.
- Agents list, until 2026-09-06: an 18-digit internal primary key.
- **Inbox: every customer is a phone number.** Their name arrives in Meta's
  payload and is discarded on the way in.

**Fix:** persist the customer name and show it. Replace ids in pickers with the
number and label.

**Verdict: fails.**

---

## 6. Direct manipulation

> **Apple:** "People experience more engagement and comprehension when they
> directly manipulate onscreen objects."

**Where we stand:** the Enabled toggle on the Agents list acts on the real
deploy/pause endpoints immediately. The agent id copies on click.

**What's lacking:** **the Inbox has zero input fields.** The object most in need
of direct manipulation in the entire product — a live customer conversation —
cannot be touched. You can read it and do nothing.

**Fix:** a reply composer, and the ability to close a conversation.

**Verdict: fails.**

---

## 7. Progressive disclosure / depth

> **Apple:** "Distinct visual layers and realistic motion convey hierarchy."
> Show what matters; keep the rest one deliberate step away.

**Where we stand — the best-executed principle here.** The connector action
editor shows four fields and hides headers, fixed values and macros behind a
collapsed **Advanced**. Raw webhook payloads live on their own tab. Debug is
explicitly labelled as not a business report.

**What's lacking:** little. Two screens over-hide instead — Templates and
Template Debug both demand you choose a WABA when exactly one exists.

**Verdict: passes.**

---

## 8. Deference

> **Apple:** "The UI helps people understand and interact with the content, but
> never competes with it."

**Where we stand:** chrome is restrained; status is a dot and a word rather than
a coloured pill; the tables let data lead. Documented divergences from the Figma
exist *in favour of* the system — tinted pills are reserved for counts, not
status.

**Verdict: passes.**

---

## 9. Aesthetic integrity

> **Apple:** "How well an app's appearance and behaviour integrate with its
> function."

**For us:** a serious operational tool that touches live customer messaging
should look calm and behave predictably — not playful, not decorative.

**Where we stand:** consistent, restrained, tokenised. Loading states are real
skeletons rather than spinners on most screens. Empty states offer a next action
instead of a dead "coming soon" — Human Handover does this even while admitting
it is unbuilt.

**What's lacking:** four sidebar entries lead somewhere effectively empty
(Human Handover, Profile, and both Template Studio screens that just ask for a
WABA). Behaviour and appearance disagree: they look like destinations and are
not.

**Verdict: mostly passes.**

---

## 10. Accessibility

> **Apple:** a requirement, not a feature. Minimum 44×44pt targets, meaningful
> labels, full keyboard operation.

**Where we stand:** better than expected. `focus-visible` styling in **66
files**; 73 `aria-label`s; 20 `sr-only` helpers; 23 explicit roles; **no image
without an `alt`**; 34 `htmlFor` label bindings.

**What's lacking:**

- **Touch and click targets.** Only 21 uses of `h-11`/`min-h-11` (44px) against
  roughly 30 buttons sized `p-1`, `p-1.5`, `h-7` or `h-8` — below Apple's
  minimum. Icon-only row actions are the worst offenders.
- **Mashed accessible names.** Dashboard agent buttons read as "smsaPaused" and
  "ActiveIndiaMART Buyer Discovery Agent" — every scrap of text inside the
  button concatenated. Fixed on Inbox rows on 2026-09-06; the same fix is owed
  to Dashboard.
- **Keyboard-only navigation has never been tested.** Focus styles existing is
  not the same as the app being operable without a mouse.

**Fix:** raise every interactive target to 44px. Give buttons real
`aria-label`s. Run one keyboard-only pass.

**Verdict: mixed** — good foundations, unverified in practice.

---

## Fixed on 2026-09-07

The first pass at this list. What changed, and what it did not:

- **Feedback.** A confirmation mechanism now exists and is wired into **18 call
  sites across 7 files** — every mutation that changes what a customer sees or
  that destroys something. Each names what happened and to what, not "Success".
  Template Studio and the agent detail tabs are still silent.
- **Forgiveness.** Connector and connector-action deletes now confirm, so every
  delete in the product asks first. Undo still does not exist anywhere.
- **The dead Disconnect button is gone**, removed rather than wired — "Remove
  from Meta" already frees a number, deliberately and with a confirmation.
- **Silent refusal.** The connector panel’s Save button was disabled with
  nothing explaining why; it now lists what is still needed. Found by a test
  timing out against the dead button while trying to prove something else.

Unchanged and still failing: consistency (five verbs for one act), recognition
over recall (customers are still phone numbers), direct manipulation (still no
way to reply), the lying success-rate metric, and 44px touch targets.

The scorecard below is **as first assessed**, kept so the change is visible.

## Scorecard

| # | Principle | Verdict |
|---|---|---|
| 1 | Feedback | **Fails** — 77 mutations, 1 confirmation |
| 2 | User control | **Fails** on forgiveness — no undo, uneven confirms |
| 3 | Consistency | **Fails** on language — 5 verbs for one act |
| 4 | Clarity | Mixed — excellent copy, one lying metric |
| 5 | Recognition over recall | **Fails** — customers are phone numbers |
| 6 | Direct manipulation | **Fails** — cannot reply to a customer |
| 7 | Progressive disclosure | **Passes** |
| 8 | Deference | **Passes** |
| 9 | Aesthetic integrity | Mostly passes — four empty destinations |
| 10 | Accessibility | Mixed — good foundations, untested |

---

## The order Apple would fix these in

1. **A confirmation mechanism for all 77 mutations.** Fixes feedback, and makes
   dead controls visible as dead.
2. **A reply composer in the Inbox.** Direct manipulation of the one object that
   matters most.
3. **Two verbs, everywhere.** Save and Publish.
4. **Confirm the two deletes that don't**, and make the wizard rail clickable.
5. **The customer's name**, and the agent column on Skills.
6. **Hide the success-rate metric** until conversations can close.
7. **44px targets**, real button labels, one keyboard pass.

---

## Honest limits

This maps principles to counted evidence and to a walk of every screen. It does
**not** rest on completing flows end to end — no agent was created, no skill
saved, no connector deployed — and no screen was looked at as an image; the DOM
was read as text.

The feedback, consistency, accessibility and undo findings are all counted from
source and hold regardless. Clarity and aesthetic-integrity judgements would
sharpen with a visual pass.

## Related

- `docs/audit/2026-09-06-product-audit.md` — screen by screen: what exists, what
  is broken
- `docs/audit/2026-09-06-ux-principles-audit.md` — the audit this reference was
  distilled from
- `DESIGN.md` — our own design system, which the visual half of this already
  enforces well
