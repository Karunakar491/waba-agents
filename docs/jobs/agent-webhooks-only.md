# Keep only agent/conversation webhooks

## Job

An operator opens the Webhooks panel deciding what happened to a conversation;
they see only events that belong to an agent on this platform, because
everything else is dropped at the door instead of burying the signal at nine
rows to one.

## Proof

Measured on production before and after:

- Before: 4,882 of 5,434 rows (**90%**) unattributed.
- After the one-off cleanup: **4,882 deleted, 552 attributed rows intact, 0
  unattributed remaining.**
- After this code change: the unattributed count must stay at 0 while
  conversations keep being recorded.

`WebhookControllerCampaignFilterTest` 3/3 pass; `mvn -o clean test-compile`
exit 0.

## Notes

Founder instruction, 2026-09-03: "I want only AI wale webhooks or conversation
related."

Two parts, both needed:

1. **Campaign filter** (was excluded earlier, now wanted): drops
   externally-originated status-only webhooks carrying
   `biz_opaque_callback_data`, which is Karix's marketing product tagging its
   own sends on the shared WABA. Applies even when the number *is* one of ours.
2. **Drop unattributed** (new): a payload matching no agent is no longer
   persisted at all.

Meta allows one callback URL per app, so this endpoint receives every event on
the WABA — other products' numbers, template and account events, campaign
traffic. None of it is processable here.

What the deleted rows actually were, checked rather than assumed: 3,213 with no
extractable `phone_number_id` and containing neither a `messages` nor a
`statuses` node; 1,606 real messages for numbers belonging to no agent here;
79 that merely predated their own agent's creation by hours.

**A false alarm I raised and corrected:** 79 rows named a live agent's number
(`1103393549522539`, active), which looked like customer messages being dropped
by a live agent. They all predate that agent's creation — last failure 06:26,
agent created 06:41 the same morning. No outage. Worth remembering as a reason
to check timestamps before escalating.

**Trade-off accepted knowingly:** webhooks arriving before a number is bound to
an agent are now invisible, so "I created an agent and its first messages are
missing" loses its paper trail — which is exactly what those 79 rows were.
Hence `webhook.persist-unattributed=false` as a flag, not a hard deletion of
the code path: set true and restart to get it back.

Deletion was done with a verified `mysqldump` of the whole table taken
immediately before, copied off-box and confirmed to end with `Dump completed`,
and a scoped `WHERE account_id IS NULL`. Founder-authorised.
