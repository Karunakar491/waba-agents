# Tasks

Running backlog of known gaps and follow-ups. Not a sprint board — just so nothing gets silently dropped between sessions.

## Open

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

## Resolved

### 3. `agent_onboarding` — confirmed not needed, closing
- **Status**: Resolved 2026-08-16. Not implemented, not being added.
- **Finding**: `docs/meta-api/agent-onboarding.md` documents `POST agent_onboarding` as an async entity/data-prep bootstrap call. But `docs/meta-api/settings.md` (line 22-23, 44) documents that `PUT agent_config/settings` without an `agent_id` already uses **"create-or-fetch" behavior** and returns the real `agent_id` in its response — which is exactly what `AgentDeployService.java:713-717` already does (write-once `metaAgentId` capture off the settings PUT response). Founder confirmed the current live WABA's agent was onboarded directly via this API path, no `agent_onboarding` call involved, and it works correctly.
- **Conclusion**: `agent_onboarding` is a documented but unused alternate/legacy provisioning path for the WhatsApp channel specifically — our settings-first flow already covers real entity creation. Not revisiting unless a concrete failure ties back to its absence.
