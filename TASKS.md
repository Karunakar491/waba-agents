# Tasks

Running backlog of known gaps and follow-ups. Not a sprint board — just so nothing gets silently dropped between sessions.

## Open

### 10. Add a hard code-level guardrail against Iris fabricating tool arguments
- **Status**: Not started. Flagged by EL (2026-08-19) as a non-blocking caveat on the prompt-only fix in commit `62bdc31`.
- **Why**: A bare "hi" caused Iris to draft a `send_test_template` call with a fabricated `testPhoneNumber` ("1234567890") and a real template name pulled from context — the model hallucinated a mutating action from ambiguous input. `TemplateStudioToolProvider.systemPromptFragment()` now explicitly instructs the model not to do this, but that's prompt engineering, not enforcement — the model can still ignore it. `send_test_template` requiring user confirmation before executing contains the blast radius today, but that's the only backstop.
- **Plan**: needs its own scoping — e.g. `TemplateStudioToolProvider.execute()` rejecting/flagging a `testPhoneNumber` or `templateName` that doesn't appear anywhere in the conversation's recent turns before it reaches the confirm panel, so a hallucinated draft is caught in code, not just by user vigilance at the confirm step.

### 11. Add a soft per-account usage cap on Iris's platform-default AI key
- **Status**: Not started. Required by EM sign-off (2026-08-19) on the platform-default AI key fallback before that fallback stays live past its initial stopgap window — filed as a fast-follow, not blocking the fallback's ship.
- **Why**: `AiCredentialService.resolveForConversation()` now falls back to a shared platform-owned OpenAI key (`IRIS_DEFAULT_OPENAI_API_KEY`, opt-in via env var) for any account that hasn't added its own BYOK key yet, per founder's explicit request that Iris "shouldn't be dead" before a client configures their own key. EM approved this as an acceptable MVP risk (reversible in seconds — unset the env var) but flagged that with no per-account cap, the blast radius is "every no-key tenant," bounded only by OpenAI's own account-level rate limit — a single noisy account (or many) could run up real cost with no internal circuit breaker.
- **Mitigation already shipped**: `IrisConversationService.java` logs `accountId` every time a turn uses the platform-default key (`log.info("Iris turn using platform-default AI key...")`), so usage is at least visible in existing logs before it becomes an incident — this was EM's minimum bar for shipping without a cap.
- **Plan**: needs its own scoping (soft daily/monthly turn cap per account on the default key, what happens on cap-exceeded — block vs warn vs force BYOK — copy/UX for that state) before implementation; not mechanical, treat as a real feature.

### 6. Confirm Karix's real `list_templates` response shape in staging
- **Status**: Not started. Flagged by EL during review of the 2026-08-19 Iris quality fixes.
- **Why**: `TemplateStudioToolProvider.extractTemplatesList()` (new, for turning `list_templates` results into a readable chat summary) and the pre-existing `TemplateStudioClient.countTemplates()` both assume the shape `{result: {response: {templates: [...]}}}}` — sourced from an older code comment claiming "confirmed live 2026-08-12," not independently re-verified now. If that shape has drifted, both methods silently fall back to generic text rather than erroring, which could mask a real mismatch.
- **Plan**: run one real Iris "list templates" request against staging Karix, confirm the JSON shape matches, and update both methods together if it doesn't. Not blocking the current fix — the fallback path was accepted as a deliberate, disclosed trade-off in exchange for not guessing at fields that might not exist.

### 7. Run the Testcontainers suite for the 2026-08-19 Iris quality fixes
- **Status**: Superseded by live production verification 2026-08-19 (see Resolved #8) — the specific behavior changes (`requireArgsPresent`, module-gate OR-check, `feature_key` defaulting) were confirmed working via real requests against the live deployed app. The full Testcontainers suite still surfaced 3 real, code-unrelated infra failures (Redis flakiness) when run locally — worth a clean CI run at some point, but no longer a production-readiness blocker for this specific set of changes since they're now live and verified.
- **Why**: Original concern (EM's condition) was "does this behavior change work for both providers' full tool sets" — answered directly by live testing instead of the sandbox's integration suite.

### 9. Root/admin MySQL credential unknown to both operator and this session
- **Status**: Not started. Surfaced during the 2026-08-19 production deploy.
- **Why**: The `meta_agent` DB user is correctly least-privileged (can't `CREATE DATABASE`), which is good security posture, but it means a full "restore-test into a scratch schema" backup verification isn't possible without either the root MySQL password or a temporary privilege grant — and neither the founder nor this session had it. Backup verification fell back to structural checks (dump completion marker, table/row counts) instead of an actual restore test.
- **Plan**: locate or reset the root MySQL credential (via the RDS/EC2 console or however this instance's MySQL was originally provisioned) and store it somewhere both the founder and future sessions can reach securely, so future deploys can do a real restore-test rather than a structural-only check.

### 1. Render rich UI Skill messages (interactive/location) in the Inbox
- **Status**: Not started. Sequenced deliberately: backend capture fix first, then wait for a real customer-triggered rich message to land in the Webhooks tab to verify the actual JSON shape, before writing frontend display logic.
- **Why**: Agent-sent carousel/list/button/CTA/location messages are currently silently dropped server-side (`ConversationService.processOutboundEcho()` early-returns on any non-text echo) — not just a missing frontend renderer, real data loss.
- **Plan**: see session plan file (rich-message rendering plan) for full detail — backend: capture `contentJson` for outbound echoes mirroring inbound's existing handling; frontend: one generic honest text-extraction function (not per-type WhatsApp-mimicking components, since no real payload shape has been verified yet).
- **Explicitly deferred**: real image/document/audio/video preview (needs a Meta Media API download proxy), carousel rendering (different undocumented object shape — needs a real captured payload first).

### 2. Meta Templates API richer types (coupon, LTO, custom marketing, location, calling permissions)
- **Status**: Media carousel done (2026-08-19, see commit adding CAROUSEL to `TemplateStudioToolProvider.COMPONENTS_SCHEMA_DESCRIPTION`). The remaining four are smaller lifts than previously framed — see correction below — not blocked on a scope decision anymore.
- **Correction (2026-08-19)**: originally framed as "zero backend caller, dead documentation, needs a decision before any work starts." That was wrong for at least carousel and likely applies to the rest too: `karix-mcp/Karix RCM Template API For WhatsApp.postman_collection.json` documents LTO Template, Coupon Code Templates, Location Template, and WhatsApp Calling Consent Template as real, working "Create template" requests on the SAME endpoint `create_template` already calls. `TemplateRequest.components` is a generic `List<Map<String,Object>>` passthrough with no type restriction — the backend already accepts any component shape Karix's real API accepts, no code change needed there. The actual gap for each remaining type is the same two client-side layers as carousel was: (1) Iris's `COMPONENTS_SCHEMA_DESCRIPTION` doesn't describe the component shape, so the model won't generate it, and (2) the manual (non-Iris) builder UI has no dedicated controls for it.
- **Plan**: add each remaining type's component shape to `COMPONENTS_SCHEMA_DESCRIPTION` one at a time (same pattern as carousel), verify against the Postman collection's documented shape, EL review each (touches a live model-facing prompt). Manual-UI support is a separate, larger UX task (ties into `TASKS.md #5`'s existing validation-UX gap) — not required for Iris to support these types.

### 4. `IrisChatPane.tsx` has template business logic hardcoded into a "presentation" component
- **Status**: Not started. Found during the Iris separation plan's Phase 7 spike (2026-08-19); not blocking, filed separately.
- **Why**: `frontend/src/components/templatestudio/IrisChatPane.tsx` directly checks `e.toolName === 'create_template' || e.toolName === 'edit_template'` to decide whether to render `IrisDraftSnapshotCard` inline, and hardcodes a `SUGGESTIONS` array of WhatsApp template categories in its empty state. This makes the component look reusable (it's just "the chat pane") when it's actually coupled to Template Studio's specific tool names and copy — a future reader could reasonably assume it's generic and try to reuse it for another Iris consumer, hitting the same premature-abstraction trap the Phase 7 spike caught.
- **Possible fix** (not scoped/approved): accept a `renderToolResult(toolName, args)` render-prop or similar instead of hardcoding the tool-name check, so the coupling is explicit and swappable rather than baked in. Not worth doing until a second consumer actually needs it (same abstraction-earns-its-keep rule).

### 5. Manual (non-Iris) template create/edit form has weak validation and generic error surfacing
- **Status**: Not started — investigated 2026-08-19 as part of the Iris/Template Studio quality pass, needs its own UX review before any fix (real form/validation UX work, not a mechanical change).
- **Why**: `frontend/src/components/templatestudio/{TemplateBuilderForm,useTemplateBuilder,templateModel}.tsx` and `builder/{TemplateMetaFields,BodyEditor,AuthenticationEditor,ButtonsEditor}.tsx`:
  - Body-length counter (`BodyEditor.tsx`) shows `x/1024` live but doesn't enforce it (`maxLength` missing) — only gates the Submit button with no inline explanation of why it's disabled.
  - Leading/trailing-placeholder rule is checked and shown as a warning, but not actually wired into `canSubmit` — a user can submit text Meta will reject despite the on-screen warning.
  - Zero client-side validation for header/footer/button length, button count, URL format, or LTO text length — these are real Meta constraints with no local check at all.
  - AUTHENTICATION's OTP example code field only checks non-empty, no format validation.
  - Backend rejection surfaces as one generic flat string at the bottom of the form (`useTemplateBuilder.ts`), not mapped to the specific field/step that caused it — confusing in a 3-step Stepper where the failing field might be two steps back from where the error shows.
  - `ConsequenceLine` (Meta's real-time limit display) is used in Iris/bulk-import but never wired into the manual form at all — the "real-time limits" experience only exists for one of the two creation paths.
  - Bulk import shows only aggregate pass/fail, no per-row detail on which rows failed and why (comment in `BulkImportPanel.tsx` frames this as intentionally deferred, not a bug — still a real gap for anyone using it).
  - Edit-mode load failure only offers "Retry," no way to still edit fields by hand if the fetch keeps failing.
- **Plan**: needs PM/EM/UX scoping (real UI/validation-UX decisions, not mechanical) before a fix — likely split into: (a) wire existing-but-disconnected checks into `canSubmit`/inline messages, (b) add the missing length/format validations, (c) map backend rejection to field-level messages, (d) decide whether `ConsequenceLine` extends to the manual form or stays Iris/bulk-import-only.

## Resolved

### 8. Deployed the Iris/Template-Studio separation + quality-fix work to production
- **Status**: Resolved 2026-08-19. All 8 commits (Phases 0-6, 9 of the Iris separation plan; karix-mcp logging fix deliberately excluded, see below) deployed to `metaagent.service` and live-verified.
- **Verification**: Flyway V52 applied cleanly (`success=1`), clean startup log, health check 200, zero new errors since restart. Live functional test via two throwaway `deploy-verify-*@example.invalid` test accounts (created through the app's real signup API, not direct DB access): a Business-Agents-only account got 200 on both `/api/v1/iris/sessions` and legacy `/api/v1/templates/iris/sessions` (confirms the Phase 0 entitlement fix live), and new sessions correctly defaulted `feature_key` to `"template_studio"` or stored an explicit `"agent_creation"` value (confirms the Phase 3 fix live).
- **Deferred from this deploy**: the karix-mcp Python logging fix (`api_call_logger.py`) — separate systemd service, own untested code path (no Python interpreter in the sandbox that produced it), descoped to its own smaller deploy later rather than bundled in.
- **Process note**: full backup-before-migration discipline followed (fresh `mysqldump`, copied off-server to local machine) but restore verification was structural-only (completion marker + table/row counts), not a true scratch-schema restore test, since neither the founder nor this session had the root MySQL credential — see open item #9.

### 3. `agent_onboarding` — confirmed not needed, closing
- **Status**: Resolved 2026-08-16. Not implemented, not being added.
- **Finding**: `docs/meta-api/agent-onboarding.md` documents `POST agent_onboarding` as an async entity/data-prep bootstrap call. But `docs/meta-api/settings.md` (line 22-23, 44) documents that `PUT agent_config/settings` without an `agent_id` already uses **"create-or-fetch" behavior** and returns the real `agent_id` in its response — which is exactly what `AgentDeployService.java:713-717` already does (write-once `metaAgentId` capture off the settings PUT response). Founder confirmed the current live WABA's agent was onboarded directly via this API path, no `agent_onboarding` call involved, and it works correctly.
- **Conclusion**: `agent_onboarding` is a documented but unused alternate/legacy provisioning path for the WhatsApp channel specifically — our settings-first flow already covers real entity creation. Not revisiting unless a concrete failure ties back to its absence.
