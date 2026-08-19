# Tasks

Running backlog of known gaps and follow-ups. Not a sprint board — just so nothing gets silently dropped between sessions.

## Open

### 6. Confirm Karix's real `list_templates` response shape in staging
- **Status**: Not started. Flagged by EL during review of the 2026-08-19 Iris quality fixes.
- **Why**: `TemplateStudioToolProvider.extractTemplatesList()` (new, for turning `list_templates` results into a readable chat summary) and the pre-existing `TemplateStudioClient.countTemplates()` both assume the shape `{result: {response: {templates: [...]}}}}` — sourced from an older code comment claiming "confirmed live 2026-08-12," not independently re-verified now. If that shape has drifted, both methods silently fall back to generic text rather than erroring, which could mask a real mismatch.
- **Plan**: run one real Iris "list templates" request against staging Karix, confirm the JSON shape matches, and update both methods together if it doesn't. Not blocking the current fix — the fallback path was accepted as a deliberate, disclosed trade-off in exchange for not guessing at fields that might not exist.

### 7. Run the Testcontainers suite for the 2026-08-19 Iris quality fixes before production
- **Status**: Not started. EM's explicit condition when approving the `requireArgsPresent` behavior change.
- **Why**: `requireArgsPresent()` is a new behavior change on every `sendMessage()` call across both Iris providers (Template Studio, Business Agents), not just template creation — verified only by `mvn compile`/`test-compile` in this sandbox (no Docker available for the real Testcontainers-based integration suite). Needs the actual suite green, specifically covering both providers' full tool sets, before this reaches production.
- **Plan**: run `mvn test` (with Docker available) in CI/staging and confirm all `IrisTemplateCreationScenariosTest`, `ModuleAccessFilterTest`, and related Iris tests pass, not just compile.

### 1. Render rich UI Skill messages (interactive/location) in the Inbox
- **Status**: Not started. Sequenced deliberately: backend capture fix first, then wait for a real customer-triggered rich message to land in the Webhooks tab to verify the actual JSON shape, before writing frontend display logic.
- **Why**: Agent-sent carousel/list/button/CTA/location messages are currently silently dropped server-side (`ConversationService.processOutboundEcho()` early-returns on any non-text echo) — not just a missing frontend renderer, real data loss.
- **Plan**: see session plan file (rich-message rendering plan) for full detail — backend: capture `contentJson` for outbound echoes mirroring inbound's existing handling; frontend: one generic honest text-extraction function (not per-type WhatsApp-mimicking components, since no real payload shape has been verified yet).
- **Explicitly deferred**: real image/document/audio/video preview (needs a Meta Media API download proxy), carousel rendering (different undocumented object shape — needs a real captured payload first).

### 2. Meta Templates API (coupon, LTO, media carousel, custom marketing, location, calling permissions)
- **Status**: Parked — to discuss before any work starts.
- **Why**: 6 fully documented sub-APIs under `docs/meta-api/Meta Templates API Documentation/` with zero backend caller (`MetaApiClient`) and zero UI surface found anywhere. Either staged reference material for a future feature that never got built, or genuinely dead documentation — needs a decision on whether it's in scope at all before scoping how.

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

### 3. `agent_onboarding` — confirmed not needed, closing
- **Status**: Resolved 2026-08-16. Not implemented, not being added.
- **Finding**: `docs/meta-api/agent-onboarding.md` documents `POST agent_onboarding` as an async entity/data-prep bootstrap call. But `docs/meta-api/settings.md` (line 22-23, 44) documents that `PUT agent_config/settings` without an `agent_id` already uses **"create-or-fetch" behavior** and returns the real `agent_id` in its response — which is exactly what `AgentDeployService.java:713-717` already does (write-once `metaAgentId` capture off the settings PUT response). Founder confirmed the current live WABA's agent was onboarded directly via this API path, no `agent_onboarding` call involved, and it works correctly.
- **Conclusion**: `agent_onboarding` is a documented but unused alternate/legacy provisioning path for the WhatsApp channel specifically — our settings-first flow already covers real entity creation. Not revisiting unless a concrete failure ties back to its absence.
