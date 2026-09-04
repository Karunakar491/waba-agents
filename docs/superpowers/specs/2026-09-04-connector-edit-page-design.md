# Connector edit page — one place to configure an integration

- Date: 2026-09-04
- Status: design, not approved
- Replaces: the `AddConnectorModal` + `AddToolModal` pair inside `AgentDetailPage.tsx`

## Who this is for

Whoever is wiring a business's API into an agent — today that is us on a client's
behalf, and the goal is that it stops being us. They open a connector deciding
*"will this actually work, and will the agent use it correctly?"* and today they
cannot answer either question without leaving the app.

## Why now — what today proved

Every item below was observed on 2026-09-04, not assumed.

1. **The work is buried.** To change how a tool calls an API: agent → Connectors
   tab → expand a collapsed chevron → pencil on the tool row → a modal with
   tabs. Four levels, and the chevron gives no hint that tools live under it.
2. **A wizard-created connector cannot be called.** `StepConnectors.tsx` is 413
   lines that create a connector and define **no tools**. The wizard implies you
   have connected something; nothing is callable until you go and find the tool
   editor.
3. **The library cannot express behaviour.** `/library/connectors` manages
   connectors and has zero tool support, so the reusable place is the one place
   you cannot say what the API does.
4. **You cannot read a response.** The Run panel prints the raw JSON envelope, so
   `<` renders as `<`. The document is there and unreadable
   (`docs/e2e-test-runs/2026-09-04-xml-tool-run.png`).
5. **Failures are numbers.** `Meta API error: 400`, `Meta API error: 409`. Meta's
   real message is captured in `MetaApiException.responseBody` and dropped. Two
   wrong conclusions in one session came from this.
6. **The UI blocks working configurations.** Nested bodies work (string-encoded);
   `DELETE` with a body works. Both are refused by our editor.
7. **Three verbs for one action.** "Publish connector", "Add", "Publish changes",
   "Publish & Test".

## The shape

A full page at `/library/connectors/:connectorId`, not a modal. Sections, all on
one page, progressive rather than hidden behind tabs:

| Section | Content | Exists today? |
|---|---|---|
| Overview | name, description, base URL, auth type + shape, which agents run it | partly — modal |
| Tools | list; each expands **inline** into the request editor | modal only |
| Request | method, path, path/query/header params, body incl. **nested**, live preview | partly |
| Response | Run it, render the real response **readably**, save an example | Run exists, unreadable |
| Mapping | tick the fields that matter → generates agent-facing text | does not exist |
| Advanced | `enum`, macros, `user_auth_required`, certificate | `enum` unsupported in UI |

## The decision this design needs

**Response and mapping do not exist in Meta's model.** `BizAIOmniChannelConnectorToolRequest`
has `name`, `description`, `request_definition`, `user_auth_required`,
`user_auth_action_config` — and nothing else. No response schema, no transform.
The agent receives whatever the partner returns. Our own `Connector` entity has
no columns for either, and tools are not stored locally at all.

So there are two ways to build these two sections:

### (a) Observed and advisory — recommended

- Run the tool, store the **real response** as an example (ours, additive column).
- Operator ticks the fields that matter.
- We generate the *text* that steers the agent: the tool `description`, and
  suggested skill instructions naming those fields.
- Nothing is enforced. The agent can still see the whole payload.

Why this first: it is where the evidence points. IndiaMART returns **20 fields
per result** to answer "who sells biryani in Delhi", and `price` can be `"N/A"`
with inconsistent units, `trustseal` can be the string `"N/A"`. Those are
*instruction* problems — the agent needs telling what to trust — before they are
transform problems. Buildable now, no new runtime.

### (b) Enforced — later, and only on demand

A gateway: the connector's base URL points at us, we translate in both
directions. Unlocks XML/SOAP **request** bodies, real field mapping, response
trimming, retries, caching.

Cost, stated plainly:
- We must store the partner's credential. Today we deliberately do not —
  `Connector.java:73`: *"field NAMES and non-secret OAuth settings only. Never
  values."* Reversing that is a founder decision.
- We become a runtime dependency: our uptime is the agent's uptime, our latency
  stacks on a response already at 11.6s.

**Recommendation: build (a) now, with the Mapping section's data model shaped so
(b) can enforce the same mapping later without re-modelling it.** Do not build
(b) until a real client needs an XML *request* body — and note that XML
*responses* already work with no gateway at all.

## The constraint that shapes everything

**Meta scopes tools per phone number**: `/{phoneNumberId}/agent_connectors/{connectorId}/tools`.
So a connector's tools belong to *one agent's deployment*, not to the connector
definition. A page at `/library/connectors/:id` editing tools is therefore
editing a template, not a live object — unless it is scoped to an agent.

Two options:

1. **Library holds templates; deploying instantiates.** The page edits the
   template. Requires new local storage for tool definitions and an explicit
   answer to: *when a template changes, do live agents change?*
2. **The page is always agent-scoped** (`/agents/:agentId/connectors/:id`). No
   new storage, edits are immediately real, but nothing is reusable — which is
   the problem the library exists to solve.

**Recommendation: (1), with no automatic push.** A template edit never touches a
running agent; instead each deployment shows "running an older version — review
and update". Silent push would edit live client behaviour, which the production
data rules forbid in spirit even though it is not data.

This needs founder sign-off before code: it is the difference between "edit this
connector" and "edit this connector on this agent", and it is expensive to
reverse.

## Phasing

**Phase 0 — stop the UI lying (prerequisite, small, ship first).** The page will
present all of this; none of it should be built on the current foundation.
- Return Meta's error message instead of `Meta API error: NNN`.
- Render the Run response readably — unwrap `output.data`, print strings as text.
- Allow `DELETE` with a body; keep blocking it on `GET` (verified: Meta drops a
  GET body, delivers a DELETE body).
- One verb for creation.

**Phase 1 — the page, read-mostly.** Route, Overview, Tools list, Request editor
moved out of the modal. Behaviour-neutral: same payloads, same endpoints.

**Phase 2 — nested body.** Recursive string-encoded nodes, per the capability
matrix. Real feature, own diff.

**Phase 3 — Response + Mapping, option (a).** Additive migration for the saved
example and field selection. Generates description/instruction text.

**Phase 4 — wizard reduction.** `StepConnectors` drops to a picker plus "not
configured yet — finish in Connectors", and stops being 413 lines.

**Phase 5 — gateway, option (b).** Only on real demand.

## Out of scope

- The gateway (Phase 5 is a placeholder, not a commitment).
- Connector-level auth *types* — untested by the capability matrix; needs its own
  probe before the Advanced section claims to support anything.
- Response size limits, timeouts, redirects — also unprobed.

## Open questions

1. Templates with no automatic push, or always agent-scoped? (Recommendation: templates, no push.)
2. Mapping advisory now, or hold out for enforced? (Recommendation: advisory.)
3. Does the Connectors section live under Library, or get promoted to top-level nav?
4. Is a connector without a working tool allowed to be marked ACTIVE at all? Today it is, and it reads as done when it is not.
