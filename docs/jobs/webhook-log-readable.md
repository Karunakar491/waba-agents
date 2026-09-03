# Make the webhook log readable

## Job

An operator investigating "why didn't the agent reply to this customer" opens
the Webhooks panel deciding whether Meta ever delivered the message; they see
filterable rows with a plain-English summary of each payload, instead of a wall
of raw JSON they have to read by eye.

## Proof

- `npx tsc --noEmit` exit 0.
- Post-deploy: the panel renders against real production webhook rows, filters
  return the expected subset, and summaries are legible.

Recorded in `docs/e2e-test-runs/`.

## Notes

This is a rewrite of an existing panel, so it is not additive from the
operator's point of view — anyone used to the old layout has to relearn it.
That is the intended trade: the old one was unreadable enough that people
stopped using it.

Rows visible here are now strictly the caller's own account (see
[[webhook-message-trace]]). Unattributed payloads — unknown phone number,
failed signature check — are no longer shown to anyone, which means this panel
can no longer be used to debug traffic that doesn't match an agent. That is a
real loss of a debugging surface and is deliberate.

Related but deliberately **not** in this job:

- The **campaign filter** (drops externally-originated status webhooks from
  Karix's marketing product on the shared WABA) — excluded by founder decision.
  Worth revisiting: 4,878 of 5,430 rows in `webhook_raw` (90%) are
  unattributed, which is very likely that traffic. This job makes the noise
  readable; the filter would stop it at the door.
- The **two-tier retention change** — held out because it deletes production
  rows. See the deploy discussion; 973 rows would go on first run for 2.1 MB of
  space, so it is not the fix for the disk-full outages either.
