# Iris: Business-Agent Creation Tool Expansion

Status: Brainstormed and approved by founder 2026-09-03. Pending implementation plan.

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
| Skills | `list_skills`, `get_skill`, `update_skill`, `delete_skill` (rounds out the existing `create_skill`) | `AgentService.getSkills/getSkill/updateSkill/deleteSkill` | update/delete: Y |
| Connectors | `create_connector`, `list_connectors`, `get_connector`, `update_connector`, `delete_connector`, `create_connector_tool`, `run_connector_tool` | `AgentDeployService.createConnector/listConnectors/getConnector/updateConnector/deleteConnector/createTool/runTool` | create/update/delete: Y; `run_connector_tool` executes a live call — treat as mutating for confirmation purposes even though it doesn't change state, since it hits a real external system |

`create_skill` (existing) is unchanged.

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
prompts for the other's use case). Once this spec's ~14 new tools land, Template Studio's
chat would gain the same 14 agent-creation tools with zero relevance to what a user there is
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

## Open questions for the implementation plan

- Exact JSON schema / argument descriptions for each new tool (mirrors the level of detail
  `TemplateStudioToolProvider.COMPONENTS_SCHEMA_DESCRIPTION` has for templates) — not
  drafted here, belongs in the plan.
- Whether `create_connector`'s `auth_type` argument should expose `OAUTH2`/`BASIC`/`CUSTOM`
  in its schema — the audit found these are "defined but NOT currently supported" per
  `connectors.md`. Likely answer: schema should only offer whatever Meta actually accepts
  today; confirm exact supported set before drafting the schema, don't assume.
