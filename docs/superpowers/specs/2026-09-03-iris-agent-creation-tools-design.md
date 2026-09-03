# Iris: Platform Agent-Building Roadmap

Status: Brainstormed and approved by founder 2026-09-03, all three phases scoped. Pending
implementation plan.

## Phased roadmap

Three phases, in this order, each a hard prerequisite for the one after it:

1. **Phase 0 — Meta API documentation verification.** Before building anything on top of
   `docs/meta-api/`, verify it's actually accurate. Two of the ~19 doc files were already
   found stale this session (`agent-onboarding.md`, `ui-skills.md`) just from incidental
   cross-checking — the rest haven't been systematically verified. This is the direct lesson
   from the agent-creation outage debugged earlier this same session: a stale doc note
   ("not needed") sat unquestioned for weeks while the underlying Meta behavior changed
   under it. Building 24+ new tools on unverified documentation risks repeating that
   exact failure mode at a much larger scale. See "Phase 0" section below.
2. **Phase 1 — Business-agent creation tools.** The original scope of this spec: ~24 new
   Iris tools covering Basics, Business Persona, Knowledge Base, FAQ, Skills, UI Skills,
   and Connectors, scoped to the creation wizard (`IrisRail.tsx`), stopping before actual
   deployment. Depends on Phase 0 being done for the doc files it touches (settings.md,
   skills.md, ui-skills.md, faq.md, websites.md, connectors.md, connector-tools.md,
   agent-onboarding.md, eligibility.md). See "Phase 1" sections below — this is the bulk of
   the document, largely unchanged from the original brainstorm plus corrections already
   made during review.
3. **Phase 2 — Edit an existing (already-deployed) agent.** Extending Iris to a new UI
   surface on `AgentDetailPage.tsx`, so an operator can ask Iris to change an agent that's
   already live and talking to real customers — not just one still being built. Scoped
   2026-09-03: reuses every Phase 1 tool unchanged, extends Phase 1's "Iris never touches
   rollout state" rule with no exceptions (deploy/pause both stay human-only on every
   agent), no new confirm-gating tier. One open, deliberately undecided question — whether
   Iris should see agent performance data before proposing edits — left for the
   implementation plan. See "Phase 2" section below.

## Problem

Iris (the platform's AI chat assistant, BYOK across OpenAI/Anthropic/etc.) exposes exactly
6 tools today: 5 for Template Studio (`create_template`, `edit_template`, `list_templates`,
`get_template`, `send_test_template`) and 1 for Business Agents (`create_skill`, write-only,
no read/update/delete). The founder's stated goal: Iris should be able to build a complete
Business Agent end-to-end through conversation, not just add one skill blind.

An audit of every file in `docs/meta-api/` against the actual backend found that this is
overwhelmingly *not* a backend-build problem — of ~45 documented Meta operations, nearly
all already have a working Java service method and a working REST endpoint the UI already
calls. The gap is specifically that Iris never calls any of them. This spec covers wiring
existing, already-working capabilities into Iris's tool-calling layer for the Business
Agent creation flow — not building new backend capability.

**Coverage accounting — this spec does NOT cover all ~45 documented operations, and that's
deliberate.** Roughly:
- **~24 operations → covered here**: Basics, Business Persona, Knowledge Base (websites),
  FAQ, Skills, UI Skills, and Connectors (create/list/get/update/delete + tools), all listed
  in the Scope table below.
- **~15 operations → deliberately excluded**, listed under Non-goals: post-creation
  management (allowlist, thread-control, business-info, eval, delete-agent, agent-event,
  agent-test), file uploads, and connector credential rotation (safety reason, see below).
- **~6 operations → Template Studio**, excluded entirely per the founder's instruction —
  a different product, not touched by this spec at all.
An earlier draft of this spec undercounted its own scope (dropped FAQ and UI Skills
entirely, and proposed including connector credential rotation without checking whether it
was safe to). Both are corrected below.

## Phase 0: Meta API documentation verification

**Goal:** every `docs/meta-api/*.md` file that Phase 1's tools depend on is confirmed
accurate against current live behavior — not just "read and trusted" — before any tool
schema gets written from it.

**Why this is Phase 0, not a nice-to-have:** the entire agent-creation outage debugged
earlier this session traced back to exactly this failure mode — `agent-onboarding.md`
documented a real precursor call, someone closed it as "not needed" based on behavior that
was true *at the time*, and nobody re-verified it when Meta's behavior changed weeks later.
`ui-skills.md` had the same shape of staleness (claimed "not implemented" for a feature that
shipped a month earlier). Both were caught by accident during unrelated work, not by any
systematic check. Building ~24 new tools whose entire correctness depends on these docs
being right is the same risk at a much larger blast radius if this isn't done first.

**In scope for Phase 0** — the doc files Phase 1's tools are built from:
`settings.md`, `skills.md`, `ui-skills.md`, `faq.md`, `websites.md`, `connectors.md`,
`connector-tools.md`, `agent-onboarding.md`, `eligibility.md`.

**What "verified" means, per doc:**
1. Every documented request/response field cross-checked against the actual DTO/entity
   Java class it maps to — do the field names, types, and required/optional status still
   match?
2. Every documented "not supported" / "not implemented" / "TODO" note re-checked against
   current code — is it still true, or stale like the two already found?
3. Where practical, one real live call per endpoint group (matching this session's own
   discipline: real curl reproductions, not just static reading) to confirm the documented
   shape matches what Meta actually returns today, not just what it returned when the doc
   was written.
4. Any staleness found gets fixed in the doc itself as part of this phase, with a dated
   note (matching how `agent-onboarding.md` was corrected earlier this session) — not just
   flagged and left.

**Out of scope for Phase 0:** the doc files Phase 1 doesn't touch (allowlist, thread-control,
business-info, eval, delete-agent, agent-event, agent-test, webhook-standby-handoff, and all
Template API docs) — verify those if/when a future phase actually depends on them.

## Non-goals

- **Template Studio is untouched.** Founder: "leave that template related stuff, it's a
  different product." `TemplateStudioToolProvider`'s 5 tools are not modified, extended,
  or touched in any way by this work.
- **Post-creation agent *management* tools** — allowlist (`allowlist.md`), thread control
  (`thread-control.md`), business info (`business_info.md`), evals (`agent-eval.md`),
  delete-agent (`delete-agent.md`), agent events (`agent-event.md`). These operate on an
  agent that already exists and is live; creation and management are different jobs with
  different risk profiles. Natural v2, not part of this spec.
- **Actual deployment/activation.** Iris never calls `AgentDeployService.deploy()`
  (`rollout.enabled = true`, the call that makes the agent start responding to real
  customers). That stays a manual, human-clicked step at the end of the wizard, same as
  today. This is the one hard boundary that was explicit in the brainstorm: Iris can
  configure everything up to a fully-ready draft; a human decides when it goes live.
- **The curl-paste-and-execute connector idea** explored during brainstorming (operator
  pastes a raw curl command, Iris parses and test-executes it against a live third-party
  API, with credential redaction before the text ever reaches the LLM) is a real, separate
  feature with its own security surface (SSRF protection, secret redaction pipeline). It's
  not needed for a first version — `create_connector` / `create_connector_tool` can take
  the same structured fields (method, path, params, headers, body, auth shape) the manual
  UI already collects. Revisit the curl-paste UX as a follow-on once the structured version
  is live and used.
- **Connector credential rotation** (`upsertApiKey`, `upsertCertificate`, `upsertOAuth`) —
  same reason as the curl-paste exclusion above: these endpoints exist specifically to carry
  a real secret value, which has no safe way to travel through an LLM's context today. See
  the "Connector credential handling" note under Scope below for the full reasoning and how
  `create_connector`/`update_connector` are scoped to avoid the same problem.
- **Rich template *send* parameters, `limited_time_offer`/`call_permission_request`
  component types.** Found during the audit to be genuine gaps (nothing in this codebase
  supports them, not just Iris) — but they're Template Studio concerns, excluded per the
  first non-goal above regardless.

## Why phone-binding isn't a blocker

Early in scoping, Connectors looked like they'd need deferral because
`AgentDeployService.createConnector()` hard-guards on `requirePhoneNumberId(agent)`. That
guard is real, but irrelevant here: in the existing 7-step wizard, phone binding already
happens in **Step 1 (Basics)**, before Business Persona, Knowledge Base, Skills, or
Connectors are ever reached. By the time Iris would be helping with any of the tools below,
`agent.phoneNumberId` and `agent.metaAgentId` are already set. No wizard reordering, no
backend changes to defer Meta-side writes — this spec assumes the current step order is
unchanged (a separate wizard-reorder idea was raised and explicitly declined by the
founder: "yeah it's ok, let it be").

## Scope: new tools, all in `AgentCreationToolProvider`

| Group | New tools | Existing backend method(s) they call | Mutating? |
|---|---|---|---|
| Basics | `update_agent_basics` | `AgentService.updateAgent()` (displayName, customerFacingName) | Y |
| Business Persona | `update_business_persona` | `AgentService.updateAgent()` (tone, language, behaviorRules, systemPrompt, personaSampleReply) | Y |
| Knowledge Base | `add_knowledge_website`, `list_knowledge_websites`, `update_knowledge_website`, `delete_knowledge_website` | `AgentService.addWebsite/getWebsites/updateWebsite/deleteWebsite` | add/update/delete: Y |
| FAQ | `create_faq`, `list_faqs`, `get_faq`, `update_faq`, `delete_faq` | `AgentService.addFaq/getFaqs/getFaq/updateFaq/deleteFaq` | create/update/delete: Y |
| Skills | `list_skills`, `get_skill`, `update_skill`, `delete_skill` (rounds out the existing `create_skill`) | `AgentService.getSkills/getSkill/updateSkill/deleteSkill` | update/delete: Y |
| UI Skills | `create_ui_skill`, `list_ui_skills`, `get_ui_skill`, `update_ui_skill`, `delete_ui_skill` | `AgentService.addUiSkill/getUiSkills/getUiSkill/updateUiSkill/deleteUiSkill` | create/update/delete: Y |
| Connectors | `create_connector`, `list_connectors`, `get_connector`, `update_connector`, `delete_connector`, `create_connector_tool`, `run_connector_tool` | `AgentDeployService.createConnector/listConnectors/getConnector/updateConnector/deleteConnector/createTool/runTool` | create/update/delete: Y; `run_connector_tool` executes a live call — treat as mutating for confirmation purposes even though it doesn't change state, since it hits a real external system |

`create_skill` (existing) is unchanged.

**Connector credential handling — corrected 2026-09-03, before this spec's first review.** Meta's `POST/PUT agent_connectors` body (`BizAIOmniChannelConnectorRequest`) can carry a literal secret in `auth_config` — a real API key value for `API_KEY` auth, a real `client_secret` for OAuth2. If `create_connector`/`update_connector` accepted these as normal tool arguments, an operator would have to type the actual secret into the Iris chat, which goes straight into the LLM's context and out to whichever third-party provider is configured via BYOK — the same leak the curl-paste idea was excluded for above.

**Fix:** `create_connector`/`update_connector` only accept the non-secret shape — `name`, `description`, `base_url`, `auth_type`, and (for API-key auth) the header/query/body **field names** the connector expects, never values. This matches `ConnectorDefinitionEditor.tsx`'s existing pattern exactly ("deliberately has NO field to type a secret into"). Supplying the actual key/certificate/client-secret stays a manual step in the existing `ConnectorDeployModal.tsx` UI, never through chat — same "Iris configures the draft, a human handles the sensitive final step" boundary already established for deploy() elsewhere in this spec. `upsertApiKey`/`upsertCertificate`/`upsertOAuth` (credential rotation) are excluded from this spec entirely for the same reason, grouped with the curl-paste exclusion above.

## UI reactivity — the wizard must reflect what Iris just did, live

**Found while reviewing this spec, not part of the original brainstorm — a real,
pre-existing gap, not hypothetical.** Checked the current `create_skill` tool (the only
mutating tool Iris has today): `IrisRail.tsx` doesn't import `useQueryClient` at all, and
has zero query-invalidation calls anywhere. Meanwhile the step components it sits next to
(`StepSkills.tsx`, `StepKnowledgeBase.tsx`, etc.) only refresh their own TanStack Query
caches (`agent-skills-view`, `agent-faqs`, `agent-websites`, `agent-ui-skills`, ...) in
response to *their own* manual mutations — never in response to Iris. Right now, if an
operator asks Iris to create a skill, it's created on the backend but the Skills list
sitting in the same wizard step does not update until something unrelated happens to
trigger a refetch. Adding ~23 more mutating tools without fixing this makes the problem
24x worse, not just present — the entire pitch of "watch the wizard fill itself in as you
talk to Iris" depends on this working.

**The fix is small and doesn't require new backend work.** `IrisConversationService`
already returns `toolName` on every `MessageDto` (`IrisConversationService.java:108`) — the
frontend already knows which tool ran on every message, it just never acts on it.
`IrisRail.tsx` needs to:
1. Import `useQueryClient`.
2. After a message exchange completes, if the response includes a `toolName` for a
   successfully-executed mutating tool, invalidate the query key(s) that tool affects.
3. A small `toolName → queryKey[]` map, e.g.:
   `create_skill/update_skill/delete_skill` → `['agent-skills-view', agentId]`,
   `['skills', wabaId]`; `create_ui_skill/update_ui_skill/delete_ui_skill` →
   `['agent-ui-skills', agentId]`; `create_faq/update_faq/delete_faq` →
   `['agent-faqs', agentId]`; `add_knowledge_website/update_knowledge_website/
   delete_knowledge_website` → `['agent-websites', agentId]`; `update_agent_basics/
   update_business_persona` → `['agent', agentId]` (or whatever query key the relevant step
   reads the base Agent fields from — confirm exact key in the plan);
   `create_connector/update_connector/delete_connector` → the connector list query key
   `StepConnectors.tsx` uses (not yet checked — confirm in the plan).
4. Read-only tools (`list_*`/`get_*`) need no invalidation — they don't change state.

This belongs in the implementation plan as a first-class task, not an afterthought bolted
on at the end — it's the difference between this feature actually working and it silently
looking broken.

## Confirm-gating

No new pattern needed. Every tool marked "Mutating? Y" above sets `requiresConfirmation=true`,
identical to how the 6 existing tools already work — the model drafts the call, the operator
sees a confirm panel with the real arguments, nothing executes until they approve. Read-only
tools (`list_*`, `get_*`) execute immediately, same as `list_templates`/`get_template` today.

## Known dependency: `featureKey` tool-scoping gap

Found during the audit, not introduced by this work, but it gets materially worse if left
unfixed here: `IrisConversationService.sendMessage()` builds the tool list as
`toolProviders.stream().flatMap(p -> p.tools().stream())` — unconditional, ignoring
`featureKey` entirely, despite `featureKey` (`"template_studio"` vs `"agent_creation"`)
being persisted per session specifically to distinguish these two surfaces. Today this is
low-risk (Template Studio's chat can technically call `create_skill`, the wizard's IrisRail
can technically call `create_template` — harmless in practice since neither surface's UI
prompts for the other's use case). Once this spec's ~24 new tools land, Template Studio's
chat would gain the same 24 agent-creation tools with zero relevance to what a user there is
doing — real confusion risk, not just theoretical.

**Recommendation:** fix `featureKey`-based filtering as part of this implementation, before
adding the new tools, not after. `IrisToolProvider` needs a way to declare which
`featureKey`(s) it applies to (or `sendMessage` needs to filter `toolProviders` by the
session's `featureKey` before flattening) — small, mechanical fix, but it's the right order
of operations.

## Error handling

Matches the existing pattern used by `TemplateStudioToolProvider`'s tools — no new
handling philosophy:
- A tool execution that throws `BusinessException` (or `MetaApiException`, which extends
  it) surfaces the exception's message back into the conversation as a tool result, so Iris
  can explain the failure in plain language and suggest a next step, rather than the
  conversation silently stalling.
- Connectors specifically: `create_connector`/`update_connector` calls reach Meta
  immediately (matching how the manual UI already behaves) — a failure there is a real,
  live Meta-side error, same shape as the ones debugged extensively earlier this session
  (raw error message from `MetaApiException`, wrapped with context by the tool's own
  catch block, never leaked to the user unwrapped).

## Testing

- Each new tool needs the same shape of coverage `create_skill` already has: a unit/
  integration test asserting the tool is correctly registered with `requiresConfirmation`
  set as specified above, and that its dispatch calls the right underlying service method
  with the right arguments.
- `featureKey` filtering (the dependency above) needs its own test: a session with
  `featureKey="template_studio"` must not see any of the new agent-creation tools in its
  tool list, and a session with `featureKey="agent_creation"` must not see the 5 Template
  Studio tools.
- No live Meta reproduction needed for most of these (unlike the WABA/onboarding fixes
  earlier this session) — the underlying service methods are already live-proven via the
  existing UI paths that call them today. The new work is the tool-calling wrapper, not
  the Meta integration itself.
- UI reactivity (above) needs its own explicit test: after Iris executes a mutating tool,
  the corresponding query key must be invalidated — a frontend test asserting
  `invalidateQueries` was called with the right key for each `toolName`, not just a manual
  "looked fine when I tried it" check.

## Open questions for the implementation plan

- Exact JSON schema / argument descriptions for each new tool (mirrors the level of detail
  `TemplateStudioToolProvider.COMPONENTS_SCHEMA_DESCRIPTION` has for templates) — not
  drafted here, belongs in the plan.
- Whether `create_connector`'s `auth_type` argument should expose `OAUTH2`/`BASIC`/`CUSTOM`
  in its schema — the audit found these are "defined but NOT currently supported" per
  `connectors.md`. Likely answer: schema should only offer whatever Meta actually accepts
  today; confirm exact supported set before drafting the schema, don't assume.
- Whether the tool-execution wrapper's exception handling covers Jakarta Bean Validation
  failures (e.g. a skill body over its length limit) as gracefully as it covers
  `BusinessException`/`MetaApiException` — checked for Meta-facing errors, not yet checked
  for plain request-validation errors on the ~24 new tools.
- Whether 24 simultaneously-active tools creates real tool-selection accuracy problems for
  the model (too many similar-sounding options to reliably pick from) — worth watching
  during implementation; possible mitigation is scoping which tools are exposed to the
  wizard's *current step* rather than all 24 always-on, but that's a bigger change than
  this spec assumes and shouldn't be built preemptively without evidence it's needed.
- Whether Iris-created records should carry any distinguishing marker (vs. a human's manual
  UI action) for audit/debugging purposes — not currently planned, flagging as a possible
  small addition, not a requirement.

## Phase 2: Edit an existing (already-deployed) agent

**Status: scoped 2026-09-03, ready for planning alongside Phase 0/1.** Extends Iris to a
new UI surface so an operator can ask Iris to change an agent that's already live and
talking to real customers — not just one still being built in the wizard.

**Why this isn't just "reuse the Phase 1 tools on a different page":**
- **No UI surface exists yet.** Confirmed via `grep` — `IrisRail.tsx` is imported nowhere
  except `CreateAgentPage.tsx`. Adding an Iris chat surface to `AgentDetailPage.tsx` is new
  frontend work.
- **The safety context changes.** Phase 1's "Iris configures a draft, a human clicks
  deploy" boundary works because nothing is live yet — a bad tool call before deploy is
  cheap to fix, nobody's seen it. On an agent that's already deployed, editing a skill or
  the business persona via chat has immediate, live consequences the moment it's confirmed.
  Confirm-gating (human approves before execution) still applies and still helps, but it's
  no longer backstopped by "nothing's live yet."

**Safety boundary — resolved 2026-09-03:** Iris never calls `deploy()` or `pause()` on any
agent, draft or live. This is not a new rule for Phase 2 — it's Phase 1's existing boundary
("Iris never touches rollout state") carried over unchanged. Considered allowing Iris to
`pause()` a live agent specifically (pausing is the reversible, risk-reducing direction, so
there was a real argument for it) — founder decided against it: no exceptions, rollout
state stays 100% human-only on every agent regardless of context. Simpler rule, nothing
conditional to get wrong.

**Tool reuse:** every Phase 1 tool (Basics, Business Persona, Knowledge Base, FAQ, Skills,
UI Skills, Connectors) is reused unchanged here — same `AgentCreationToolProvider`
registrations, same `featureKey="agent_creation"` (no new featureKey needed; it's the same
tool set, just reachable from a second UI surface now). No tool needs a "live agent"
variant — the underlying service methods (`AgentService.updateSkill()`, etc.) don't
distinguish draft from live agents today, and there's no reason to invent that distinction
here. Confirm-gating is identical to Phase 1 — no extra confirmation tier for live-agent
edits; if real usage after shipping shows that's insufficient (e.g. deleting an in-use
skill needs a stronger warning than deleting a draft one), that's a follow-up informed by
actual behavior, not a guess made now.

**Genuinely new capability, not just a Phase-1 tool relocated — optional, not required for
v1 of this phase:** should Iris be able to see recent conversation volume / performance
signals for the agent before proposing an edit, so it isn't suggesting changes blind to how
the agent is actually doing? This would need a new read-only tool pulling from
`agent-eval.md`/analytics data — explicitly excluded from Phase 1 as "post-creation
management," but directly relevant once Iris is operating on a live agent. Worth a real
product decision, not a default: ship Phase 2 without it first, or build the visibility
tool alongside it? Flagging for the implementation plan to decide, not deciding here.

**UI surface design** (exact placement/layout on `AgentDetailPage.tsx` — persistent side
rail matching `IrisRail.tsx`'s pattern vs. a drawer/modal, default open or closed) is an
implementation-plan-level decision, not resolved here — same treatment Phase 1 gave its own
tool-schema details.
