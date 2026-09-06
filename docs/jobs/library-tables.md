# The library sections become tables you can scan

## Job

Someone opens Skills, Knowledgebase, Connectors or Business persona because
something is wrong — "the agent quoted the old price" — and today they get a
grid of cards they must read one by one to find the thing they came for; after
this each section is a table they can scan down a single column, every row says
how many agents use it before they touch it, and the Agents list shows Meta's
real agent id instead of our internal one.

Founder, 2026-09-06: "Change it to tables", "Count is enough broo", and on the
Agents list "dont show the rubbish our data, show the genuine Agent Id which
Meta gave, if it doesnt have agent id, then leave it empty. If someone clicks on
agent id, it should have a copy button then only it should copy" — refined in
the same conversation to "Clicking the id should copy, instead of a seperate
copy agent id button".

## Proof

`tsc -b --force` clean. `jest` — **71 passed**, unchanged.

Not yet proven against the running app. This section is filled in after the
deploy; the job is not done until the tables are on the server and a browser has
opened them.

## Notes

**Why tables at all.** The card grid was built for browsing. Nobody browses
these screens — they arrive with a specific problem and need a lookup. Cards
force you to read every item to find one; a table lets you scan a column. That
is the entire argument, and it is why "Used by" is a column rather than a line
of prose in a card footer.

**Why a count and not agent names.** Names are more useful when deciding whether
an edit is safe, but they wrap the row and push everything else out. The founder
chose the count directly.

**Why "No agents" and not "0".** A zero under a heading that says "Used by"
reads as a measurement. It is closer to a warning: nothing is using this, so
publishing it achieves nothing.

**`usedByNote`.** Connectors already knew how many deployments were
`OUT_OF_SYNC`, which is exactly the "the live version is behind what you saved"
signal the founder asked for. It renders under the count rather than folded into
it, because the two numbers answer different questions: how much does an edit
affect, and how much of that is already stale.

**The agent id.** `metaAgentId` was already on the Agent entity and already
being serialized — `AgentListItem` unwraps the whole entity — so this needed no
backend change. Verified against production before building anything: 8 of 10
agents carry one, and the two that don't are drafts that never deployed, which
is exactly the "leave it empty" case.

The id is ~110 characters (`pfbid0827eUTZVLf2C9zGaaVGmjRweT8B…`), so the column
shows the first 10 and copies all of it. The full value is in the `title`, and
the click is `stopPropagation`'d — copying an id and being navigated away from
the list would cost the user their place.

This replaces the previous arrangement, where our own 18-digit primary key sat
behind a hover-revealed copy button inside the Status column. That id is useless
to Meta support, which is the one place an operator needs an agent id.

**Component tests.** There is no React Testing Library in this project — every
existing test is pure logic — so `CopyableId` is covered by the browser test
rather than by adding a test library, which would need a TECH-STACK.md change.
Clipboard behaviour is a browser API and is more honestly tested in a browser
anyway.

**Not in this job.** The publish-to-Meta-on-save modal, shared FAQ collections,
and the UI skills section are the next three pieces. Knowledgebase and Business
persona still need converting and still open their editors inline.
