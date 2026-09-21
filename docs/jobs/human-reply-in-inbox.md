# Let a human answer a customer

## Job

A support lead opens the Inbox, sees a conversation Meta's agent handed off, and
types a reply the customer receives on WhatsApp — then hands the thread back to
the agent when they are done. Today they can see the conversation and nothing
else: a customer who needs a person cannot reach one.

## Proof

`docs/e2e-test-runs/2026-09-21-human-reply.md`, carrying:

- a real WhatsApp message sent from the Inbox to the reserved test number
  `+91 90100 11634`, with Meta's returned message id
- the same message persisted and rendered in the thread as outbound
- `POST /conversations/{id}/release` returning 200, and the agent answering the
  next inbound message
- backend tests for the reply path, and a Playwright journey driving the
  composer by role

## Notes — documentation versus implementation

Read from `docs/meta-api/thread-control.md` and
`docs/meta-api/webhook-standby-handoff.md`, not from the code.

| Meta's model | Built? |
|---|---|
| Handoff signal: top-level `value.messages`, no `standby` wrapper | ✅ `HandoffClassifier`, wired into `ConversationService` |
| Mark the conversation as needing a human | ✅ `needs_human` (V13), set by `ConversationStore.markNeedsHuman` |
| **Taking control = sending a message. No API call.** | ❌ `MetaMessageSender` exists, is `@Service`, and **nothing calls it** |
| Release control back to the agent | ✅ `ThreadControlClient`, `POST /agents/{id}/thread-control/release` |
| Operator sees which conversations need them | ❌ `needsHuman` never reaches the frontend |
| Operator can type a reply | ❌ no composer, no endpoint |

The hard half is done. What is missing is the operator's own path: an endpoint
that sends and persists, the flag surfaced, and somewhere to type.

**Correcting my own earlier read of this.** I told the founder this was "no human
can reply, nothing exists" and proposed building a send endpoint from scratch. He
pointed at the Handover Protocol. Reading it changed the design: control is taken
implicitly by sending, so there is no "take control" call to build, and the
agent-pauses-until-released behaviour I had offered as a choice is simply how
Meta works.

## Scope

1. `POST /conversations/{id}/reply` — send via `MetaMessageSender`, persist as
   outbound, keep `needs_human` until released.
2. `POST /conversations/{id}/release` — release thread control for that customer,
   clear `needs_human`.
3. Surface `needsHuman` in the conversation list and thread.
4. Composer in the thread view, plus a "hand back to agent" action.

Out of scope: media replies, canned responses, assignment between operators.
Text only, because text is what the customer is waiting for.
