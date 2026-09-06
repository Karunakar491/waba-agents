# Judged against Apple's UX principles — 2026-09-06

The first audit (`2026-09-06-product-audit.md`) asked *what exists and what is
broken*. This one asks a harder question: **if Apple shipped this SaaS product,
would it pass?**

Judged against the principles Apple actually designs to — clarity, feedback,
forgiveness, consistency, user control, recognition over recall, progressive
disclosure, direct manipulation, deference.

Verdict up front: **it would not pass, and one principle fails so completely it
outweighs the rest.**

---

## 1. Feedback — **fails**

> *The system always keeps the user informed about what is happening.*

The app performs **77 mutations**. Exactly **one** of them tells the user it
worked — `BusinessProfileTab.tsx:155` renders "Published!". The other 76 succeed
in silence.

You press Save. The button un-presses. Nothing else changes.

Errors, by contrast, are handled properly: `ErrorBanner` appears in 42 files,
and the messages are real sentences. So the app is articulate about failure and
mute about success — which trains the user into the worst possible belief:
**silence means nothing happened.**

That belief is why the dead Disconnect button is dangerous. It behaves exactly
like every working button in the product. There is no way to tell them apart.

There is no toast system, no snackbar, no confirmation region — nothing to build
on. This is not a missing polish pass; the mechanism does not exist.

**This is the finding.** Everything below is a smaller problem.

---

## 2. Forgiveness — **fails**

> *Users should be able to undo. Actions should be reversible.*

**Zero occurrences of undo in the entire codebase.**

Every destructive action is one-way, and they are unusually consequential —
deleting an agent tears its configuration off a live WhatsApp number; publishing
a persona changes what real customers are told immediately.

What exists instead is *pre*-confirmation, and it is genuinely good in places:
the agent delete modal names each teardown step and reports what Meta did not
clean up; the persona publish modal names the number and states that customers
see the change at once.

But confirmation is not forgiveness. It moves the whole burden to the instant
before the click, and it is applied unevenly:

| Action | Confirms? |
|---|---|
| Delete agent | Yes — typed confirmation, per-step report |
| Delete skill | Yes |
| Delete file / website | Yes |
| Disconnect WABA | Yes |
| **Delete connector** | **No — immediate** |
| **Delete connector action** | **No — immediate** |

A user who learns "this app asks before deleting" is being taught something
false, and Connectors is where it bites.

---

## 3. Consistency — **fails**

> *The same thing is called the same name and behaves the same way everywhere.*

One underlying act — *make this real on Meta* — is called at least five things:

`Add` (105 uses) · `Deploy` (80) · `Create` (47) · `Save` (42) · `Publish` (19),
plus `Publish changes`, `Save draft`, `Save changes`, `Publish handoff`,
`Deploy now`, `Add a label`.

A user cannot build a mental model from this. Is *Publish* the same as *Deploy*?
On the Connectors page they are two different buttons on the same row doing
genuinely different things — and nothing on screen explains the difference.

Editing is inconsistent in the same way. Some things open their own page
(Skills, Connectors), some open an inline panel (Persona), some open a modal,
and one — Knowledge Base — used to open *a different screen entirely* until I
removed it today.

---

## 4. Recognition over recall — **fails**

> *Show meaningful information. Never make the user hold an identifier in their
> head.*

Raw Meta identifiers are printed where human labels belong:

- Knowledge Base upload picker: `smsa (1249896194867775)`
- Agents list, until today: an 18-digit internal primary key
- Inbox: conversations identified by phone number only — **the customer's name
  is in Meta's payload and is discarded on the way in**

The Inbox one is the worst. An operator reading a conversation cannot tell who
they are reading about. Every thread is a number.

---

## 5. Clarity — **mixed**

> *Text is legible, icons precise, functionality obvious.*

**Strong:** the copy is unusually good for an internal tool. "Disabling stops
the agent on every existing conversation. Re-enabling only resumes new
conversations — not the ones that went quiet." "Nothing is sent to Meta or Karix
until you save a mapping." Status is written in the operator's words — "Live",
"Not set up" — not the database's.

**Fails where a number lies.** Reports shows **"Success rate 0%"** and defines it
as "closed without a human handoff". Nothing can ever close, so it is 0%
forever. Perfectly clear, and false.

**Fails on unexplained distinctions.** Skills rows show "View" on some and
"Edit" on others with no stated reason. Persona says "Edit as new draft" without
saying why the live one can't be edited.

---

## 6. User control — **mixed**

> *The user initiates and controls actions.*

**Good:** nothing auto-deploys; publishing is always deliberate; editing a
library item explicitly does not reach into a running agent.

**Fails:** the 7-step agent wizard's step rail is **not clickable**. At step 6
you cannot jump back to step 2 to fix one field — you are walked backwards. On a
seven-step form that is the app driving, not the user.

---

## 7. Progressive disclosure — **passes**

> *Show what matters; keep the rest one step away.*

The best-executed principle here.

The connector action editor shows four fields — what it does, method and path,
what the agent sends, the resulting call — and hides headers, fixed values and
macros behind a collapsed **Advanced**. The Inbox keeps raw webhook payloads on
a separate tab. Debug is explicitly labelled as not a business report.

The Filters pattern — one button opening one grouped panel rather than loose
dropdowns — is applied consistently across every library screen.

---

## 8. Direct manipulation — **mixed**

**Good:** the Enabled toggle on the Agents list acts on the real thing
immediately; the id copies on click.

**Fails:** you cannot reply to a customer in the Inbox — the object most in need
of direct manipulation in the entire product cannot be touched at all. You can
read a conversation and not act on it.

---

## 9. Deference — **passes**

> *The interface gets out of the way of the content.*

Chrome is restrained, status is a dot and a word rather than a coloured pill,
and the tables let the data lead. The design system is followed carefully enough
that documented divergences from the Figma exist *in favour of* the system.

---

## Scorecard

| Principle | Verdict |
|---|---|
| Feedback | **Fails** — 77 mutations, 1 confirmation |
| Forgiveness | **Fails** — no undo anywhere; confirmation applied unevenly |
| Consistency | **Fails** — five verbs for one act; four editing patterns |
| Recognition over recall | **Fails** — raw Meta ids; customers are numbers |
| Clarity | Mixed — excellent copy, one lying metric |
| User control | Mixed — good defaults, a wizard that won't let you back |
| Direct manipulation | Mixed — can't reply to a customer |
| Progressive disclosure | **Passes** |
| Deference | **Passes** |

**Four outright failures.** An Apple review would stop at the first one.

---

## What Apple would fix first

1. **Make every action say it worked.** One shared confirmation mechanism, used
   by all 77 mutations. This is the highest-leverage change in the product: it
   fixes the trust problem, and it makes dead controls like Disconnect
   *visible as dead* instead of indistinguishable from working ones.

2. **Pick one verb per act and use it everywhere.** Most likely: **Save** for
   "keep this", **Publish** for "make it real on Meta". Retire Deploy, Add and
   Create as synonyms.

3. **Confirm every delete, or none.** Connectors and connector actions are the
   two that don't.

4. **Give the customer a name in the Inbox.** The data already arrives and is
   thrown away.

5. **Let the user reply**, and make the wizard's step rail clickable. Both are
   the same principle: the user drives.

---

## Honest limits of this audit

I judged this by loading all 19 screens against production, inventorying every
control, and reading the code. **I did not complete a single flow end to end** —
I never created an agent, saved a skill, or deployed a connector, so I have not
seen what the app does *after* a real action. And I read the DOM as text rather
than looking at screenshots, so I can say a control exists but not that a screen
looks right.

The feedback finding is safe regardless: it comes from counting mutations
against confirmations in the source, not from impressions.

---

## Related

- `docs/audit/2026-09-06-product-audit.md` — what exists and what is broken
