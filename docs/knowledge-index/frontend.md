# Knowledge index: frontend

One line per file, `path — purpose`. **Grep it. Never read it whole.**

    Grep pattern="AgentService" path=docs/knowledge-index/

A line points at a file; it does not narrate its history. Keep each under ~200
chars. A purpose needing a paragraph belongs in the file, in `TASKS.md`, or in
`wiki/`, not here.

Split by area so each file stays reviewable. A grep across the directory
searches all of them at once.

frontend/.oxlintrc.json — Oxlint config for frontend
frontend/components.json — Shadcn config — default style, CSS variables, @ alias, component output to src/components/ui/
frontend/index.html — Vite HTML entry — Inter font import lives here (DESIGN.md token location)
frontend/package.json — Frontend deps — React 18, TypeScript 5, Vite, Tailwind 3, Shadcn/ui, TanStack Query, Zustand, React Router, Axios, React Hook Form, Zod
frontend/postcss.config.js — PostCSS config — Tailwind + autoprefixer (required by Tailwind CSS)
frontend/README.md — Frontend readme — Vite + React + TS setup notes
frontend/src/App.css — Legacy Vite scaffold CSS — mostly unused; global styles live in index.css
frontend/src/App.tsx — Root — QueryClientProvider, BrowserRouter. "/" now renders RootRedirect (2026-08-04, Netflix-style module picker): reads cached entitlements (no extra fetch), redirects straight to the module's home …
frontend/src/components/agent-detail/BusinessProfileTab.tsx — AgentDetailPage tab — Business Profile live/history UI for THIS agent's phone number.
frontend/src/components/agent-detail/DeleteAgentModal.tsx — 2026-08-13 — two-phase delete dialog. Before: lists exactly what will be attempted on Meta (or states nothing exists on Meta for a draft agent).
frontend/src/components/agent-detail/DeleteFromMetaModal.tsx — Highest-stakes modal — typed phone-number confirmation before DELETE /agents/{id}/meta-agent; visually distinct from the DB-only delete modal.
frontend/src/components/agent-detail/EvalTab.tsx — AgentDetailPage tab — eval case list (paginated), run eval via useJobPoll, plain-language summary
frontend/src/components/agent-detail/RunToolModal.tsx — Test-executes a connector tool (POST .../tools/{id}/run) — JSON input textarea with client-side parse validation, status+output display. Synchronous call, no polling (not a fire-and-forget job).
frontend/src/components/agent-detail/SkillEditorModal.tsx — Add/edit skill form — title (client-side regex matching Meta's lowercase-hyphen format, server-side enforcement is TASK-043), description, instruction body (monospace, 20k char counter).
frontend/src/components/agent-detail/SkillsTab.tsx — Skills tab — reads unified GET /agents/{id}/skills-view (union of legacy agent-scoped skills + Library-attached skills, TASK-050).
frontend/src/components/agent-detail/TriggerEventModal.tsx — Agent Event trigger modal — event type/description/customer phone, status via useJobPoll.
frontend/src/components/agent-detail/UiSkillEditorModal.tsx — F22 (2026-08-07) — create/edit form for UI Skills (title/componentType select excluding flow/status/instruction); POST/PUT /agents/{id}/ui-skills[/{id}]
frontend/src/components/agent-detail/UiSkillsPanel.tsx — F22 (2026-08-07) — UI Skills list within the Skills tab (messaging section, founder-requested placement, not a separate page); GET/DELETE /agents/{id}/ui-skills[/{id}]
frontend/src/components/connectors/ConnectorDefinitionEditor.tsx — 2026-08-13 — inline create/edit panel for a library connector (inline, not Modal — same call as the Persona draft editor). Deliberately has NO field to type a secret into; the copy says so.
frontend/src/components/connectors/ConnectorDeployModal.tsx — 2026-08-13 — deploy-to-agent picker + the one place credentials are typed. Modal (not inline) because it's a one-decision commitment reaching a live agent.
frontend/src/components/connectors/connectorLibrary.ts — 2026-08-13 — LibraryConnector/AuthShape/LibraryDeployment types + form<->request mapping + requiredSecretFields (which credential values a deploy needs).
frontend/src/components/connectors/ConnectorsTable.tsx — Aggregate Connectors table row renderer (used by ConnectorLibraryPage).
frontend/src/components/create-agent/IrisRail.tsx — Figma 8.3-8.9 right rail ('Iris — Building this agent with you').
frontend/src/components/create-agent/SkillsLibraryDrawer.tsx — Figma 8.16 (node 289:2) — Skills Library docked panel over the Skills step, occupying the Iris rail slot.
frontend/src/components/create-agent/StepBasics.tsx — Step 1 (Figma 217:16). Flattened WABA×phone select (GET /waba then GET /waba/{metaWabaId}/phones per WABA), eligibility line derived from whether the number is already bound to another agent (GET …
frontend/src/components/create-agent/StepBusinessPersona.tsx — Step 2 (Figma 206:2). Four tone cards, each rendering its real WhatsApp sample-reply bubble (DESIGN.md live-preview-snippet rule), editable starting-style textarea -> agent.personaSampleReply, and …
frontend/src/components/create-agent/StepConnectors.tsx — Step 5 (Figma 252:35). Shopify/Zendesk/Custom API chips are presets that prefill the one standard connector form (name/description/base_url/auth_type/auth_config.headers[]/requires_certificate) …
frontend/src/components/create-agent/StepEvals.tsx — Step 6 (Figma 218:253). GET /reports/agents/{id}/eval/cases, 'Run all N' -> POST .../eval/run + useJobPoll.
frontend/src/components/create-agent/StepKnowledgeBase.tsx — Step 3 (Figma 213:2). FAQs (GET/POST/DELETE /agents/{id}/faq), Files (multipart POST /agents/{id}/files), Websites (POST /agents/{id}/websites), plus the background-work pill counting file/website …
frontend/src/components/create-agent/StepSkills.tsx — Step 4 (Figma 218:2). Plain-language rules via /agents/{id}/skills + /agents/{id}/skills-view (LIBRARY rows show 'From Skills Library · used by N other agents', joined client-side against GET …
frontend/src/components/create-agent/StepTestDeploy.tsx — Step 7 (Figma 215:10). Summary rows (phone / persona / 'N of 8 fields filled' / connectors) each with an Edit link that jumps back to the owning step; test conversation panel over POST …
frontend/src/components/create-agent/WizardChrome.tsx — Presentational primitives every wizard step reuses: StepHeader (breadcrumb/title/subtitle), SectionCard, LinkAction, FieldLabel/TextField/SelectField (label + optional API field name, as Figma's …
frontend/src/components/create-agent/wizardTypes.ts — Shared types + constants for the 7-step Create Agent wizard: WIZARD_STEPS labels, StepNumber, WizardState …
frontend/src/components/files/FileWebsiteTables.tsx — FilesTable/WebsitesTable renderers for FileLibraryPage's tabbed Files/Websites view.
frontend/src/components/layout/AppShell.tsx — App shell — collapsible sidebar (localStorage sidebar-collapsed; 2026-08-11 V2 rebrand slice 1: bg-brand-navy → bg-gradient-to-b from-ink to-black gradient chrome per DESIGN.md §5, logo chip + user …
frontend/src/components/layout/ClientCommandBar.tsx — Client Command Bar (item 45) — global chrome, one continuous frame with the sidebar (DESIGN.md §0 move 2, amended 2026-08-06; 2026-08-11 V2 rebrand slice 1: bg-brand-navy → bg-ink).
frontend/src/components/layout/ModuleSwitcherPill.tsx — NEW 2026-08-11 (V2 rebrand slice 1, Figma node 5:53) — module switcher pill+dropdown in ClientCommandBar, extracted to its own file to keep ClientCommandBar.tsx under the 200-line component ceiling.
frontend/src/components/persona/PersonaFilters.tsx — TASK-060 — PersonaFilters (search + status dropdown) and PersonaDraftEditor (wraps BusinessProfileTab.tsx's shared ProfileEditor), both extracted from the original oversized page during the …
frontend/src/components/persona/PersonaTable.tsx — TASK-060 — the Persona table + PersonaTableRow sub-component (extracted after an EL REJECT on the original 349-line single-file page).
frontend/src/components/persona/usePersonaData.ts — TASK-060 — account-wide Business Persona rows: drafts (GET /business-profiles/drafts) fanned out with per-phone-number live+history, client-aggregated into one row-per-profile list.
frontend/src/components/router/ProtectedRoute.tsx — Auth guard — reads isAuthenticated from Zustand, renders Outlet or Navigate to /login.
frontend/src/components/shared/ConsequenceLine.tsx — Shared one-line consequence/reassurance statement, extracted after 3rd use (Business Profile deploy, Delete-from-Meta, Agent Event)
frontend/src/components/shared/IconChip.tsx — Flat tinted-square icon container, DESIGN.md §6 — never for empty states, never as a logo.
frontend/src/components/shared/Modal.tsx — NEW 2026-08-05 — the only way a dialog renders anywhere per DESIGN.md §4/§6: real focus trap (Tab/Shift+Tab cycling), initial focus on mount, focus restored to the trigger element on unmount, …
frontend/src/components/shared/ModuleCard.tsx — NEW 2026-08-11 (V2 rebrand slice 2, Figma nodes 2:2/4:24) — module tile shared by ModuleSelectorPage (enabled, clickable) and ProtectedRoute's ModuleLockedScreen (locked preview row, enabled=false, …
frontend/src/components/shared/SegmentedControl.tsx — NEW 2026-08-12 (V2 rebrand slice 6) — generic Segmented Control (DESIGN.md §6: pill track, raised selected segment), first real consumer AiProviderPanel.
frontend/src/components/shared/StatusIndicator.tsx — NEW 2026-08-05 — the only way status renders anywhere per DESIGN.md §0 move 4/§6: dot + plain text (tone: positive/warning/negative/neutral, optional pulse for genuinely-live states only), never a …
frontend/src/components/skills/SkillsTable.tsx — Table renderer for SkillLibraryPage's aggregate skill list. 2026-08-05: status badge (Draft/Deployed) now renders via shared StatusIndicator instead of a tinted pill.
frontend/src/components/templatestudio/AiProviderPanel.tsx — NEW 2026-08-12 (V2 rebrand slice 6, Figma node 86:2) — Iris BYOK LLM key management, extracted and rebuilt from the old page's inline function.
frontend/src/components/templatestudio/auditRedaction.ts — NEW 2026-08-12 (V2 rebrand slice 4f) — redactSecrets()/redactValue(), extracted from TemplateSettingsPage.tsx's private copy so it and the new TemplateDebugPage share one redaction implementation …
frontend/src/components/templatestudio/builder/AuthenticationEditor.tsx — NEW 2026-08-12 (V2 rebrand slice 7) — OTP/COPY_CODE fields, extracted from TemplateBuilderForm.tsx.
frontend/src/components/templatestudio/builder/BodyEditor.tsx — NEW 2026-08-12 (V2 rebrand slice 7) — body text + variable examples, extracted from TemplateBuilderForm.tsx.
frontend/src/components/templatestudio/builder/ButtonsEditor.tsx — NEW 2026-08-12 (V2 rebrand slice 7) — button list editor, extracted from TemplateBuilderForm.tsx. text-primary (Add button link) → text-accent-teal-solid.
frontend/src/components/templatestudio/builder/FooterEditor.tsx — NEW 2026-08-12 (V2 rebrand slice 7) — footer text field, extracted from TemplateBuilderForm.tsx.
frontend/src/components/templatestudio/builder/HeaderEditor.tsx — NEW 2026-08-12 (V2 rebrand slice 7) — header format/media upload, extracted from TemplateBuilderForm.tsx. text-brand-green ("Media uploaded.") → text-accent-teal-solid.
frontend/src/components/templatestudio/builder/TemplateMetaFields.tsx — NEW 2026-08-12 (V2 rebrand slice 7) — name/language/category fields, extracted from TemplateBuilderForm.tsx.
frontend/src/components/templatestudio/BulkImportPanel.tsx — Templates bulk .xlsx import panel with Meta ConsequenceLine (extracted 2026-08-06 Structure B).
frontend/src/components/templatestudio/CrossWabaHealthStrip.tsx — A− fleet signal 2026-08-06 — StatusIndicator totals Pending/Rejected/Low quality across up to 5 configured WABAs via existing credential+list APIs; Focus hottest WABA; overflow +N note; fail-soft.
frontend/src/components/templatestudio/DebugFiltersPanel.tsx — NEW 2026-08-12 (V2 rebrand slice 4f, Figma node 105:11) — Method/Status pill-group filter panel for TemplateDebugPage. Exports matchesFilters() helper.
frontend/src/components/templatestudio/IrisChatPane.tsx — Iris chat transcript + hero + composer (extracted 2026-08-06 for EL 200-line cap). 2026-08-11 (V2 rebrand slice 3): pending-message dot bg-brand-pink → bg-accent-teal-solid.
frontend/src/components/templatestudio/IrisComposer.tsx — NEW 2026-08-12 (V2 rebrand slice 5) — Composer/SetupBanner extracted from IrisChatPane.tsx to keep that file under the 200-line component ceiling. No behavior change from the extraction itself.
frontend/src/components/templatestudio/IrisConfirmPanel.tsx — Docked Iris confirm pane (2026-08-06 A-): WhatsAppTemplatePreview + ConsequenceLine; Submit to Meta / Send test; plain-language non-template summary.
frontend/src/components/templatestudio/IrisDraftSnapshotCard.tsx — "Draft Snapshot" inline card (IRIS-REDESIGN-DIRECTIONS.md Direction 1) — renders create_template/edit_template turn args as a compact WhatsApp-preview, diffing against the previous snapshot …
frontend/src/components/templatestudio/settings/AddWabaPanel.tsx — NEW 2026-08-12 (V2 rebrand slice 6, Figma node 85:9) — validate WABA ID → preview → confirm-and-register flow, extracted as-is (logic unchanged) from the old page. bg-brand-pink removed.
frontend/src/components/templatestudio/settings/PhoneMappingRow.tsx — NEW 2026-08-12 (V2 rebrand slice 6) — PhoneTableRow (desktop) + PhoneCard (mobile), same phone/mapping/draft data, plus the qualityIndicator() helper (moved from the old page). bg-brand-pink removed.
frontend/src/components/templatestudio/settings/PhoneMappingTable.tsx — NEW 2026-08-12 (V2 rebrand slice 6) — extracted from WabaBlock.tsx: desktop table + mobile card stack (via PhoneMappingRow.tsx) + the Save mappings button, all driven by props from WabaBlock's state.
frontend/src/components/templatestudio/settings/WabaBlock.tsx — NEW 2026-08-12 (V2 rebrand slice 6, Figma node 84:9) — one WABA's accordion: fetch-phones mutation, phone-mappings query, save-mappings mutation.
frontend/src/components/templatestudio/settings/WabaSettingsSection.tsx — NEW 2026-08-12 (V2 rebrand slice 6, Figma node 84:2) — "Connected WABAs" card: header, Add WABA button, accordion list of WabaBlock, renders AddWabaPanel.
frontend/src/components/templatestudio/TemplateBuilderForm.tsx — Create/edit template form + sticky WhatsApp preview (2026-08-06). Render-only; state/submit in useTemplateBuilder. Meta name sanitize + body var warnings.
frontend/src/components/templatestudio/TemplateFiltersPanel.tsx — NEW 2026-08-11 (V2 rebrand slice 3, Figma node 35:9) — DESIGN.md §6 Filters pattern: one panel, grouped sections. Category/Status are Meta's real fixed enums (pill rows).
frontend/src/components/templatestudio/TemplateListEmptyStates.tsx — UnconfiguredEmpty/LibraryEmpty, extracted from TemplateListPanel.tsx in slice 3.
frontend/src/components/templatestudio/TemplateListPanel.tsx — Templates list UI (2026-08-06), orchestration only as of 2026-08-11 (V2 rebrand slice 3, Figma node 23:3) — filters state (category/language/status object, was a single statusFilter string) + queries …
frontend/src/components/templatestudio/TemplateListToolbar.tsx — NEW 2026-08-11 (V2 rebrand slice 3, Figma nodes 23:13/23:22). Two distinct real creation CTAs: "Create manually" (secondary, existing TemplateBuilderForm flow via onCreate) and "New template" …
frontend/src/components/templatestudio/templateModel.ts — Shared Template Studio types/helpers: classifyStatus, canEditStatus, extractTemplates, seedFromComponents, Meta NAME_RE/BODY_MAX/AUTH_BODY_TEXT (2026-08-06).
frontend/src/components/templatestudio/TemplateSubmitSuccess.tsx — NEW 2026-08-11 (V2 rebrand slice 4e, Figma node 99:2) — Submit Success screen shown after a create (not edit) template submission succeeds.
frontend/src/components/templatestudio/TemplateTable.tsx — NEW 2026-08-11 (V2 rebrand slice 3) — extracted from TemplateListPanel.tsx. Added hover:bg-muted row state (DESIGN.md §6 tables require hover, was resting-only before).
frontend/src/components/templatestudio/useTemplateBuilder.ts — Template create/edit state, seedFromComponents, media upload, buildComponents, submit to /templates or /edit (2026-08-06).
frontend/src/components/templatestudio/WabaPicker.tsx — Shared WABA-select dropdown (2026-08-04), used by all Template Studio sections via useSelectedWaba — extracted so the picker UI can't drift between Iris/Templates/Settings.
frontend/src/components/templatestudio/WhatsAppTemplatePreview.tsx — WhatsApp bubble preview using whatsapp-* tokens only — used by TemplateBuilderForm create/edit (2026-08-06).
frontend/src/components/waba/ConnectPhoneModal.tsx — Two-step WABA connect modal — validate WABA ID, pick phone, persist WABA + bind to agent.
frontend/src/components/waba/phoneSelection.test.ts — 2026-09-02 — 16 cases for phoneSelection.ts: fail-closed on PENDING/unrecognized/missing status, already-connected label takes priority over not-ready, empty-list and all-disabled cases for …
frontend/src/components/waba/phoneSelection.ts — 2026-09-02 — pure selection/label logic for ConnectPhoneModal.tsx's phone picker, extracted for testability (this repo's jest.config.cjs is testEnvironment 'node', testMatch only *.test.ts, no …
frontend/src/hooks/useAuth.ts — Auth hooks — useLogin, useRegister (mutate→setUser→/dashboard), useLogout (mutate→clearAuth→/login), useMe (query /auth/me, staleTime 5min)
frontend/src/hooks/useClientScope.ts — Client Command Bar (roadmap item 45, 2026-08-06) — reads/writes ?client=<id> in the URL, single source of truth for app-wide client scope.
frontend/src/hooks/useFleetRisk.ts — Client Command Bar (item 45) — React Query wrapper for GET /api/v1/clients/fleet-risk, staff-grant scoped, 60s refetch interval.
frontend/src/hooks/useJobPoll.ts — Shared bounded status-polling hook for async Meta jobs (Agent Event, Agent Eval run) — terminal states + 'unknown' fallback on poll failure/timeout
frontend/src/hooks/useModuleEntitlements.ts — Queries GET /api/v1/modules/entitlements (2026-08-03) — single source of truth ProtectedRoute/RootRedirect/ModuleSelectorPage all share; only enabled once authenticated.
frontend/src/hooks/useSelectedWaba.ts — Shared WABA-list + selected-WABA state (2026-08-04) for Template Studio's 3 nav sections — localStorage-persisted (key template-studio-waba) so picking a WABA on one section keeps it selected when …
frontend/src/index.css — Global styles — Tailwind directives, Shadcn CSS variable definitions, Karix primary=navy accent=pink (dark: 327 60% 45%), Inter font import.
frontend/src/lib/api.ts — Axios instance — baseURL from VITE_API_URL, withCredentials:true for httpOnly cookie, 401 interceptor redirects to /login
frontend/src/lib/modules.ts — NEW 2026-08-11 (V2 rebrand slice 1) — single source of truth for module metadata (key/label/description/icon/homeRoute), extracted from ModuleSelectorPage so ModuleSwitcherPill.tsx can render the …
frontend/src/lib/utils.ts — cn() utility — merges Tailwind classes via clsx + tailwind-merge, used by all Shadcn components
frontend/src/main.tsx — React entry point — mounts App into #root, wraps with QueryClient and Router
frontend/src/pages/AgentDetailPage.tsx — 2026-08-13: Settings tab's aboutLabel field added (schema/defaultValues/save payload/UI input) — this form's save PUT was already a full-payload round-trip pattern (existing bug: it never sent …
frontend/src/pages/AgentsPage.tsx — Agents list table — name/About label/phone/WABA ID/conversation count (GET /conversations/counts)/health (derived: status+phone, not Meta quality rating)/status/last updated; 'Shared' badge next to …
frontend/src/pages/BusinessPersonaLibraryPage.tsx — TASK-058/060 — standalone account-wide Business Persona page, reached via AppShell's 4th AGENT_SUB_NAV entry (/library/persona).
frontend/src/pages/ConnectorLibraryPage.tsx — Cross-agent Connectors Library card grid. 2026-08-13: system-type and auth-type chips are now real data (backed by agent_connector V45) instead of the previously-flagged gap; usageLine shows 'used by …
frontend/src/pages/CreateAgentPage.tsx — Orchestrator ONLY for the 7-step Create Agent wizard (Figma 8.3-8.9 + 8.16, nodes 217:16/206:2/213:2/218:2/252:35/218:253/215:10/289:2) — step order, shared draft state, sessionStorage draft resume, …
frontend/src/pages/DashboardPage.tsx — Dashboard — attention-triage landing page. Client-side heuristic over GET /agents (no backend attention signal yet): active+no-phone > paused > draft, sorted by urgency.
frontend/src/pages/HumanHandoverPage.tsx — Phase 2 fix (2026-08-05, item 20): was a bare centered-icon 'coming soon' stub with zero CTA — the single worst empty-state instance in the app.
frontend/src/pages/InboxPage.tsx — Conversation Audit Log — 2-panel read-only viewer. Left: conversation list (GET /conversations?accountId=). Right: message thread (GET /conversations/:id/messages). conversationId in URL param.
frontend/src/pages/LoginPage.tsx — Login/Register page. Phase 2 de-marketing (2026-08-05, item 21): removed the marketing split-screen (hero copy, unverified '10k+ conversations daily' etc stat tiles, navy brand panel) — this …
frontend/src/pages/ModuleSelectorPage.tsx — Netflix-profile-style feature picker (2026-08-04) — one card per Module (Business Agents, Template Studio), greyed + "Not enabled for this account" when disabled per useModuleEntitlements.
frontend/src/pages/ProfilePage.tsx — Account overview — 'Getting started' checklist (Connect WABA/Create agent/Publish agent) + Business Info (email, plan — editing not yet built).
frontend/src/pages/ReportsPage.tsx — New Reports nav section — Conversations (volume+success rate+by-channel), Eval (async rollup via useJobPoll, links out to per-agent EvalTab), API Calls (expandable request/response log).
frontend/src/pages/SettingsPage.tsx — Account Settings — display name, email (read-only badge), plan (Starter hardcoded for P0), Danger Zone with disabled delete button + support contact.
frontend/src/pages/SkillLibraryPage.tsx — TASK-051/052/053 — standalone Skills page at /library/skills (renamed from 'Skill Library' — that name now belongs to the separate reference catalog below).
frontend/src/pages/SkillTemplateBrowsePage.tsx — TASK-052 — Karix-curated reference catalog. Lists skill_template rows (global, same for every account), filterable by industry/use case chips.
frontend/src/pages/TemplateDebugPage.tsx — NEW 2026-08-12 (V2 rebrand slice 4f, Figma node 103:6) — raw API activity log across a WABA's Template Studio calls, for troubleshooting.
frontend/src/pages/TemplateIrisAllChatsPage.tsx — NEW 2026-08-12 (V2 rebrand slice 5, Figma node 112:2) — destination for the sidebar's "View all chats" link (DESIGN.md §6: sidebar shows only 5 most recent, this page groups everything by …
frontend/src/pages/TemplateIrisPage.tsx — Iris A- pass 2026-08-06: thin IrisWorkspace + IrisChatPane + docked IrisConfirmPanel (WhatsAppTemplatePreview + ConsequenceLine; DESIGN.md section 6 co-located, not Modal).
frontend/src/pages/TemplateSettingsPage.tsx — Template Studio Settings (2026-08-06 redesign; 2026-08-12 V2 rebrand slice 6, Figma node 83:2, EM-approved decomposition: was 870 lines, now a 54-line orchestrator).
frontend/src/pages/TemplateStudioPage.tsx — Templates Structure B + A− pass 2026-08-06. Shell: WABA dropdown + list/create/edit/bulk. List freshness via TemplateListPanel staleTime:0 refetchOnMount/focus.
frontend/src/pages/WabaDetailPage.tsx — NEW (2026-08-05, Phase 2 item 14b) — single-WABA detail page at /wabas/:wabaId, replacing WabasPage's old nested-table drill-down.
frontend/src/pages/WabasPage.tsx — WABA list with expandable per-WABA phone-number sub-table (nested `<table>` — flagged in the 2026-08-05 UX audit as worth restructuring to a WABA detail route, not yet done).
frontend/src/store/authStore.ts — Zustand persist store — user, isAuthenticated, setUser, clearAuth. Persisted to localStorage key 'auth'.
frontend/src/store/irisSidebarStore.ts — Zustand store, no persistence (2026-08-06) — sessions/loading/activeId/searchQuery/onNewChat/onSelect.
frontend/tailwind.config.js — Tailwind config — Karix brand tokens, whatsapp.* mimicry tokens for chat preview, shadcn semantic CSS-variable tokens, Inter, radius scale.
frontend/tsconfig.app.json — TypeScript app config — strict flags, bundler moduleResolution, @ path alias, ignoreDeprecations 6.0 for baseUrl
frontend/tsconfig.json — TypeScript project references — points to tsconfig.app.json and tsconfig.node.json
frontend/tsconfig.node.json — TypeScript config for Vite config file (node environment)
frontend/vite.config.ts — Vite config — React plugin, @ path alias pointing to src/
