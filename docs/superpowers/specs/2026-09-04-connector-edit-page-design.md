# Connector edit page

- Date: 2026-09-04
- Status: design, not approved

## What the user gets

Today, connecting a business's API to an agent means: create a connector, then
hunt for a hidden tool editor four levels deep, guess at the request shape, save,
get told `Meta API error: 400`, and stop. Most people stop.

After this, one screen. You connect an API, press Test, and see it work. If it
doesn't work, the screen tells you why in words.

That's the whole point. Everything below is in service of it.

## How we judge every decision here

Three questions, in this order:

1. **Will Meta support it?** If not, we don't design it. We say so in the UI.
2. **Does it make the user's job easier?** Not "is it more capable".
3. **Is the journey still simple?** A screen with six open panels is not a
   simpler journey than four hidden ones. It's a worse one.

## The journey

One thing at a time. Never all of it at once.

```
Connectors
  └─ [Connect an API]
       Step 1  Where is it?        name, URL
       Step 2  How do we get in?   auth  → [Test connection]
       Step 3  What can it do?     one action, e.g. "search products"
                                   → [Test] shows the real response
       Done    "Search products — working. Used by 1 agent."
```

Step 3 repeats to add another action. Nothing else is on screen while you're in
a step.

**Test is the centre of the design, not a nicety.** It's the only moment the user
learns whether any of this was right. Today that moment doesn't exist until a
customer message fails.

### The action screen

Default view — four fields, nothing else:

| Field | Example |
|---|---|
| What does this do? | Search for products |
| Method + URL | `POST /` |
| What does the agent send? | `query`, `city` |
| Always send | `action = product-search` |

**Advanced** is collapsed and stays collapsed: headers, fixed/macro values, enum
constraints, nested bodies, `user_auth_required`. Nobody sees these unless they
need them.

## What Meta will and won't support

Probed against the live API on 2026-09-04
(`docs/meta-api/connector-tools-capability-matrix.md`).

| We want to offer | Meta? | So the UI... |
|---|---|---|
| JSON request body | yes | offers it |
| Nested body (objects, arrays) | yes, string-encoded | offers it, under Advanced |
| GET/POST/PUT/PATCH/DELETE | yes | offers all five |
| `DELETE` with a body | yes | must stop blocking it |
| Fixed and macro values | yes | offers it |
| `enum` on a field | yes | offers it, under Advanced |
| **Read an XML API** | **yes** | offers it — no extra work needed |
| **Send an XML body** | **no** | says so plainly, up front |
| Form-encoded / multipart | no | says so plainly |
| Response schema | **doesn't exist** | we show the *real* response instead |
| Field mapping | **doesn't exist** | see below |

Two of these matter for what we promise clients: a **read-only** XML API works
today, and an API needing an **XML request body** cannot be connected at all.

## Response and mapping

Meta stores no response schema and has no transform. The agent gets whatever the
API returns.

So: **we show the real response and let the user point at what matters.**

```
Test → response appears → user ticks: product_name, price, city, mobile
     → we write that into the agent's instructions
```

The user's benefit is concrete. IndiaMART returns **20 fields per result** to
answer "who sells biryani in Delhi", and `price` is sometimes the literal string
`"N/A"`. Ticking four fields is how the agent stops reciting noise.

This is advisory — the agent still receives the full payload. Enforcing it means
routing calls through us, which means holding the client's API credentials, which
we deliberately never do today. Not now, and not without your decision.

## One decision needed from you

Meta ties tools to a phone number, so a connector's actions belong to **one
agent**, not to the connector itself. That forces a choice:

- **Reusable:** this screen edits a template; each agent gets a copy. Connect
  once, use on many agents. A later edit does **not** silently change a live
  agent — it shows "this agent is running an older version".
- **Per agent:** this screen edits one agent's live connector. Simpler to build,
  nothing is reusable, and you reconnect the same API for every agent.

**Recommendation: reusable, no silent push.** Connecting an API once is the
whole reason the library exists, and silently changing a live client's agent is
not something we should be able to do by accident.

## Order of work

**First, stop the UI lying.** Small, and everything else sits on top of it.
- Show Meta's real error, not `Meta API error: 400`.
- Make the Test response readable — today `<` prints as `<`.
- Allow `DELETE` with a body. Keep blocking it on `GET` (Meta drops it there).
- One word for "save", not four.

**Then:** the stepped journey, with Test at each step. Same API calls as today,
just reachable.

**Then:** nested bodies, `enum`, and the other Advanced items.

**Then:** tick-the-fields mapping.

**Later, only if a client needs an XML request body:** routing calls through us.

## Not doing

- Routing calls through us. Placeholder, not a plan.
- Connector auth *types* beyond what exists — unprobed, so the Advanced section
  won't claim to support them.
- Timeouts, redirects, response size limits — also unprobed.
