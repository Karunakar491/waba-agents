# Product Design Spec — Meta Business Agent Platform
**Date:** 2026-07-18
**Status:** WORKER DRAFT — pending Engineering Lead review
**Author:** Worker Agent (PM ideation capture)

---

## 1. Context

### 1.1 Platform Owner
Built for **Karix** — one of the largest Meta Business Solution Providers (BSPs). Karix's existing enterprise and SMB clients use this platform to create and manage Meta Business Agents on WhatsApp, Messenger, and Instagram.

### 1.2 Client Acquisition Flow
Clients are acquired by Karix's sales team first. They arrive at this platform already onboarded to Karix. This platform is the operational layer — not the acquisition funnel.

### 1.3 Target User
Non-technical. Business owner, support lead, or marketing team member.

**Their goal:** A working agent — not raw API access or documentation.

**What they must not see:** Tokens, API calls, Meta configuration internals.

---

## 2. Navigation Structure

Four top-level sections. Always visible.

| Section | Purpose |
|---|---|
| Dashboard | Agent overview, live metrics, entry point to Create |
| Create (Wizard) | 5-step agent creation flow |
| Reports | Aggregated analytics across agents |
| Configuration / Settings | Account-level and agent-level settings |

---

## 3. Dashboard

### 3.1 States

**New user (no agents):**
- Empty state — no charts, no placeholder data
- Single CTA: "Create your first agent"
- 30-second preview video embedded (shows what an active dashboard looks like)

**Existing user (has agents):**
- Agent cards grid
- Quick Stats bar — appears only after ≥24h of data exists

### 3.2 Agent Cards
Multi-agent from day one. Each card shows one agent.

| Metric | Description |
|---|---|
| Conversations (24h) | Total conversations in last 24 hours |
| Resolution Rate % | % resolved without handoff |
| Avg Response Time | Mean response time across 24h |
| Handoffs (24h) | Total conversations escalated |

### 3.3 Card States

| State | Visual | Label |
|---|---|---|
| Live | Green indicator | — |
| Draft | Grey indicator | "Resume setup" |
| Paused | Yellow indicator | — |

### 3.4 Empty State Policy
**No empty charts.** If data is not available, show an honest empty state with a human-readable explanation. Never render a chart with zeroes presented as data.

---

## 4. Create Wizard

### 4.1 Layout
Three-panel layout, always visible during wizard:

| Panel | Content |
|---|---|
| Left | Step list — all 5 steps visible, clickable for navigation |
| Center | Active step inputs |
| Right | Live interactive preview (appears from Step 2 onward) |

### 4.2 Time-to-First-Value Target
**Under 3 minutes** from wizard open to agent activated.

### 4.3 Auto-Generation at Step 1
On Business Description entry:
- Auto-generate agent personality defaults (tone, language, behavior rules)
- Auto-generate 5 starter FAQ pairs

These pre-fill Step 2 (Personality) and Step 3 (Knowledge). User can edit or discard.

---

### Step 1 — Identity

| Field | Constraint | Notes |
|---|---|---|
| Agent Name | 40 chars | Internal only — not shown to end-users |
| Customer-Facing Name | 25 chars | Shown to end-users in chat |
| Business Description | 200 chars | Seeds the AI prompt + auto-generation |
| Channel | Visual card selection | WhatsApp / Messenger / Instagram — pick one |
| Connect Account | WABA connection flow | See Section 6 |

Channel is **locked after creation** — cannot be changed in settings.

---

### Step 2 — Personality

Fields: tone, behavior rules, language.

Pre-filled by auto-generation from Step 1 Business Description. User reviews and edits. Live preview active.

---

### Step 3 — Knowledge *(Optional — skip allowed)*

Tabbed interface:

| Tab | Input Method |
|---|---|
| FAQ | Manual question / answer pairs |
| File Upload | Document upload (PDF, DOCX, etc.) |
| Website URLs | URL crawl / sitemap |

Knowledge is **not required for activation**. Agent can go live with personality only.

---

### Step 4 — Connections *(Optional — skip allowed)*

- External tool connectors (Zendesk, HubSpot, etc.)
- Handoff routing rules — defines where conversations escalate

**No built-in inbox.** All handoffs route externally. There is no internal conversation management.

---

### Step 5 — Go Live

- Embedded test chat — user interacts with the agent directly in the wizard
- **Activate button is locked** until user sends ≥1 test message
- "Save as Draft" always available regardless of activation state

---

## 5. WABA Connection Flow

### 5.1 Hierarchy
```
Karix Account
  └── WABAs (one or many)
        └── Phone Numbers (one or many per WABA)
              └── Agents (one agent per phone number)
```

Multi-WABA per account is supported.

### 5.2 Input Fields

| Field | Type | Notes |
|---|---|---|
| WABA ID | Numeric string | No pre-population — user must enter manually |
| Label | Text (optional) | Internal name for this WABA |

**Why no pre-population:** Karix registry is not accessible from this platform. Manual entry is the only supported path in v1.

### 5.3 Validation Flow

1. User submits WABA ID
2. Backend calls Meta API using Karix BSP token (stored in secrets manager, never exposed to frontend)
3. Backend checks:
   - WABA exists on Meta
   - WABA is under Karix BSP umbrella
4. On success: phone number list returned, user selects one
5. Phone number bound to agent

### 5.4 Error States

| Error | Message |
|---|---|
| WABA not found | "This WABA ID doesn't exist on Meta. Check the ID and try again." |
| Not under Karix | "This WABA isn't managed by Karix. Contact your Karix account manager." |
| Already connected | "This phone number is already connected to another agent." |
| Meta timeout | "Meta isn't responding. Wait a moment and try again." |

### 5.5 Help Text
Collapsible section: "Where do I find my WABA ID?" — includes annotated screenshot of Meta Business Manager.

---

## 6. Account Setup Flow (New User)

Sequential, gated. User cannot proceed to agent creation without completing each step.

| Step | Action |
|---|---|
| 1 | Sign Up — email, password, name, company name + email verification |
| 2 | Connect first WABA — modal, required before agent creation |
| 3 | WABA validation — backend calls Meta API, returns phone number list |
| 4 | Select phone number |
| 5 | Create first agent (wizard opens) |
| 6 | Dashboard populated |

---

## 7. Reports

### 7.1 States

**New user (no agents or <24h data):**
- Honest empty state
- CTA: "Create your first agent"
- No placeholder charts or zero-filled metrics

**Existing user:**
- 4 KPI cards (visible immediately, even before 24h)
- 7-day volume chart (hidden until 24h of data exists)
- Top Topics breakdown
- Handoff Reasons breakdown

### 7.2 Filters

| Filter | Options |
|---|---|
| Agent selector | All agents / individual agent |
| Time range | 7 days / 30 days / 90 days |

### 7.3 Chart Policy
Charts are hidden until 24h data exists. KPIs render immediately from available data.

---

## 8. Configuration / Settings

### 8.1 Account Section
Always visible. Not agent-specific.

| Field | Notes |
|---|---|
| Name | Editable |
| Email | Editable |
| Plan | Display only |
| Billing | External link |

### 8.2 Agent Settings
Agent selector dropdown at top. Sections mirror wizard steps:
- Identity
- Personality
- Knowledge
- Connections

In-place editing. No separate "Edit mode" toggle.

**Channel field is locked** post-creation — display only.

### 8.3 Danger Zone

| Action | Confirmation |
|---|---|
| Pause agent | Confirmation modal |
| Delete agent | Modal requiring user to type the agent name exactly |

### 8.4 Deferred from v1
- Team / user management
- Role-based access control

---

## 9. Screen Inventory

### P0 — Must Ship Day One (10 screens)

| # | Screen | Notes |
|---|---|---|
| 1 | Sign Up | Email verification included |
| 2 | Login | Standard |
| 3 | Dashboard | Empty state + populated state |
| 4 | Wizard Step 1: Identity | Includes WABA connection modal |
| 5 | Wizard Step 2: Personality | Live preview active |
| 6 | Wizard Step 3: Knowledge | Tabbed, skippable |
| 7 | Wizard Step 4: Connections | Skippable |
| 8 | Wizard Step 5: Go Live | Embedded test chat, activate CTA |
| 9 | Agent Detail | Tabbed view of agent settings |
| 10 | Conversation Audit Logs | Read-only viewer to inspect active/past agent chat transcripts |

### P1 — Deferred

| Feature | Reason |
|---|---|
| Analytics deep-dive | Requires data volume to be useful |
| Team management | Not needed for single-user launch |
| Billing | External link sufficient for v1 |
| Templates | Manual setup validates demand first |
| Notification center | No events requiring notification in v1 |
| Onboarding tour | 30s video + wizard flow covers this |

---

## 10. Engineering Constraints

### 10.1 Hard Rule — Meta API Isolation
**Frontend never calls Meta API directly.**

All Meta API calls are made by the backend using the Karix BSP token stored in a secrets manager. The token is never transmitted to or accessible from the frontend.

This applies to:
- WABA validation
- Phone number retrieval
- Agent provisioning
- Any future Meta API surface

### 10.2 Implication for WABA Flow
The WABA connection modal submits only the WABA ID to the backend. The backend performs all validation and returns only sanitized results (phone number list, error codes) to the frontend.

---

## 11. Resolved Decisions & Guardrails

- **Resolution Rate Definition:** A conversation is classified as "Resolved" if there is no user messaging activity for 24 consecutive hours and no handover/escalation event occurred during that period.
- **Knowledge File Limits:** Maximum size is **10MB** per file. Supported formats are strictly **.pdf** and **.docx** (plain text parser used for RAG ingestion).
- **Website crawling limits:** Crawl depth is restricted to **1 level** (links directly on the page) with a maximum cap of **20 pages** per domain to prevent resource and token bloat.

---

## 12. Open Questions (not yet decided)

- Session handling for partially completed wizard (auto-save interval?)
- Connector list for v1 Connections step (Zendesk + HubSpot confirmed — others TBD)

---

*WORKER DRAFT — not approved. Requires Engineering Lead review before committing.*
