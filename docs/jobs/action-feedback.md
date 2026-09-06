# Every action says it worked

## Job

Someone saves a skill, publishes a persona or deletes a connector and gets
nothing back — the button un-presses and the screen looks the same, so they
cannot tell success from a control that did nothing; after this a completed
action names itself and what it affected, and the two deletes that fired without
asking now ask.

From the principles audit (`docs/design/apple-principles-mapping.md`): the app
performed **77 mutations with exactly one visible success confirmation**, while
`ErrorBanner` appeared in 42 files. Articulate about failure, mute about success.

## Proof

`tsc -b --force` clean. `jest` — **71 passed**.

Deployed 2026-09-07. Bundle `index-BKsRGIs4.js`, md5
`75de808e588eedce5b069a59a69f08cc` — identical local and on the server, and the
bundle `index.html` references.

`e2e/action-feedback.spec.ts` (`@feedback`) — **2 passed** against production:

- **Saving a connector confirms itself**, and the confirmation names the
  connector rather than saying "Success".
- **The panel says what is still missing** before it will save — asserted on
  "Header that carries the key", then satisfied, then asserted gone.
- **Deleting a connector now asks first**, states that no agent is using it, and
  confirms after.
- **The dead Disconnect button is gone** from the agent page.

Regression: all 12 default-suite tests pass, and the 12 journey tests
(`@library-tables`, `@connector-edit`, `@inbox-order`) pass.

**This spec writes**, unlike the other audit specs — a success confirmation
cannot be proven without succeeding at something. It is scoped to the safest
write available: a connector in our own library named
`zz-feedback-check (safe to delete)`. That touches no Meta object, no agent and
no phone number; a library connector only reaches Meta when deployed, which the
spec never does. It deletes what it created and asserts it is gone, and it
cleans up a leftover from an interrupted run before creating another.

## Notes

**Why a confirmation and not a toast library.** This does one thing: confirm a
completed action. Failures keep going to `ErrorBanner`, in place, beside what
failed — an error that slides away after four seconds is an error the user can
miss, and these actions reach live customers.

**Why it says what it affected.** "Success" would have satisfied the letter of
the audit and taught the user nothing. "Persona published — customers messaging
+91 91520 04195 see it now" is the actual information.

**The most important message in it is a warning.** Saving a connector action
confirms with "deploy this connector to an agent to make it callable", because
nothing instantiates these on Meta yet. A confirmation implying the agent can
now call it would have been the most misleading sentence in the product.

**Coverage is 18 call sites across 7 files, not all 77.** The ones wired are
every mutation that changes what a customer sees or that destroys something:
agents (enable, pause, rename, delete), connectors (save, publish, deploy,
delete), connector actions (add, save, delete), skills (delete), files and
websites (upload, add, delete), personas (save, publish, delete). The remainder
are in Template Studio and the agent detail tabs and are still silent.

**Two uneven deletes fixed.** Connector and connector action deleted on the
first click while agents, skills, files and WABAs all asked first. Uneven
confirmation is worse than none — it teaches a habit the app then breaks, and a
connector can be live on several agents.

**A silent refusal is the same bug as a silent success.** The connector panel's
Save button was disabled with nothing explaining why; the blocker was usually the
auth header, further up and easy to miss once the three obvious fields were
filled. It now lists what is still needed. Found by this spec timing out against
a dead button — the test caught a real defect while trying to test something
else.

**The Disconnect button was removed rather than wired.** Freeing a number is
what "Remove from Meta" already does, deliberately and with a confirmation. Two
controls for one act, one of them silent, was never the right shape.
