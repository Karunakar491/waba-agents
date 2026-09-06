# Open a conversation on what just happened, and delete an agent from the list

## Job

Someone opens a conversation to see what a customer just said, and lands on that
customer's first message from weeks ago with no idea what the dates are; and
someone who wants an agent gone has to open it, find a danger zone and scroll —
after this the thread opens on its newest message with a date and time on every
one, the conversation list is ordered by recency with dates carrying the year,
and the Agents list deletes from the row.

Founder, 2026-09-06: "Conversations should show the latest conversation first
and user can scroll to see the previos messages and every message should have
date and time. Same thing for the left side conversations list, It should have
date and year", and "User should be able to delete the agent directly from the
list when he sees."

## Proof

`tsc -b --force` clean. `jest` — **71 passed** (three `formatListTimestampIST`
expectations rewritten, since the format deliberately changed).

Deployed 2026-09-06. Bundle `index-FgOKBL6u.js`, md5
`f6482ef4e08d19fadc4993cc49a04136` — identical local and on the server, and the
bundle `index.html` references.

`e2e/inbox-and-delete.spec.ts` (`@inbox-order`) — **4 passed, 0 skipped**,
against production:

- **Conversations are ordered newest first**, read off each row's machine-
  readable `datetime` rather than the formatted text, and asserted to be in
  descending order.
- **Every list timestamp is a time or a dated year**, and the word "Yesterday"
  appears nowhere.
- **Opening a conversation lands at the bottom of the thread.** The test walks
  up to six conversations to find one that actually overflows its container,
  because measuring a thread too short to scroll would prove nothing. Before
  this change `scrollTop` was 0.
- **Every message shows a month, a year and a time.**
- **Every agent row offers a delete**, and a live agent's is disabled with the
  reason in its `title`.

Default suite still **12 passed** — nothing regressed.

## Notes

**The skips that nearly passed for proof.** The first run of this spec reported
"2 passed, 2 skipped" and looked fine. Both skips were mine: the tests waited on
`networkidle` after clicking a conversation, but the messages query starts
*after* the click, so the network fell quiet against an empty thread and the
tests skipped themselves on "conversation has no messages". A probe against the
API showed the conversation had 12. They now wait for a message to render. A
green run containing a skip is not proof, and this one was hiding the fact that
the thing under test was never exercised.

**Open-first ordering is gone.** The list used to group open conversations above
closed ones (2026-08-05 triage fix). The founder asked for plain recency, which
is what someone scanning for "the message that just came in" needs — under the
old rule the newest conversation on the account could sit below a week-old open
one. The Open filter still isolates unanswered threads, so nothing is lost.

**"Yesterday" and weekday names were removed, not overlooked.** They read more
naturally in isolation and worse in a column: "Tue", "Mon", "Yesterday" cannot
be compared at a glance, and "Tue" is ambiguous the moment a week passes.

**Dates on every message rather than on hover.** Hover is invisible on touch and
undiscoverable if you don't know it is there, so a date you can only find by
accident may as well not exist.

**Semantics instead of test hooks.** This needed stable selectors, and the
project has no `data-testid` anywhere. Rather than introduce one, the row got a
real `aria-label` (its accessible name was previously every scrap of text inside
it read as one run-on string), timestamps became `<time datetime>`, and the
transcript became `role="log"`. All three are correct markup that happens to be
selectable.

**Delete reuses `DeleteAgentModal`.** Deleting is not one call — Meta has no
"remove everything" endpoint, so the persona, connectors, skills and UI skills
come down one at a time and any can fail. Reusing the modal means the list
cannot offer a weaker confirmation or lose the per-step report when Meta doesn't
come away clean. The detail page's guard travels with it: a bound, unpaused
agent cannot be deleted, because deleting rewrites its configuration on Meta
while it is still answering customers.
