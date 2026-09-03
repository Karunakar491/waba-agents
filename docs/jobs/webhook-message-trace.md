# Trace a message back to the webhook that caused it

## Job

An operator reading an Inbox thread hits a reply that looks wrong and needs to
decide whether the agent misbehaved or Meta sent something odd; they see a
per-message link to the exact `webhook_raw` row that produced it, with the raw
payload, instead of guessing from timestamps.

## Proof

- `mvn -o clean test-compile` and `npx tsc --noEmit` both exit 0.
- Post-deploy: the served bundle contains the jump affordance, and one real
  message in the live Inbox resolves to its originating webhook row.

Recorded in `docs/e2e-test-runs/`.

## Notes

V55 (`messages.webhook_raw_id`, nullable) **is already applied in production** —
2026-08-20, verified in `flyway_schema_history`, and its checksum matches the
committed file (`1897906656`), so no migration runs and Flyway will not refuse
to start.

Deliberately not backfilled: the originating webhook can't be derived for
historical rows. Consequence the operator will notice — the affordance appears
on new messages and not on older ones, with no explanation on screen. Worth a
follow-up empty-state, not a blocker.

Account scoping on the lookup is a founder correction (2026-08-14): the webhook
log now returns strictly the caller's own `accountId`. Unattributed rows —
unknown phone number or failed signature check — are no longer visible to any
operator. That is a **removal** of a debugging surface, deliberate, and it
narrows what this link can reach.
