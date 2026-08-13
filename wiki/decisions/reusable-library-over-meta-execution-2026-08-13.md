---
title: Reusable Library Over Meta Execution — 2026-08-13
tags: [decision, architecture, connectors, skills, agents]
date: 2026-08-13
---

# Reusable Library Over Meta Execution

## The framing (founder, verbatim)
> "My objective is to have reusable agents, skills and connectors, even if Meta doesn't allow or support we can make the provision right. Meta just exposes the APIs, we build the product."

Meta is the execution/transport layer. Our own database is the source of truth for what a reusable Skill, Connector, or (eventually) Agent *is*. A definition must be able to exist, be edited, and be counted independent of any single agent or any single Meta account being reachable.

## The pattern (already correct for Skills, now extended to Connectors)
Three layers, kept distinct rather than merged:

| Layer | What it is | Skills | Connectors (2026-08-13) |
|---|---|---|---|
| **Library definition** | Ours, reusable, exists without Meta | `skill` | `connector` (`V46`) |
| **Deployed instance** | One definition, live on one agent, has a real per-agent Meta id | `agent_skill_attachment` | `connector_deployment` (`V46`) |
| **Live-state cache** | Best-effort mirror of what Meta currently reports | (none) | `agent_connector` (`V45`) |

Connectors got a live-state cache that Skills doesn't have, because Connectors' live status/health is genuinely meaningful (a connector can go unreachable independent of the definition), while a Skill's Meta-side state is just "deployed or not."

## Why the mirror (V45) came first, then the library (V46) on top
Two different founder asks, twenty minutes apart, correctly kept as separate migrations:
1. First: "log what Meta gives us into a DB, don't only fetch live" — a pure cache, upsert-on-read, serves last-synced rows with `cached: true` if Meta is unreachable. No secrets mirrored (auth config field *names* only — actual API keys/OAuth secrets/certs are supplied per-deployment, forwarded to Meta, never written to a column).
2. Then: "we build the product, Meta just exposes APIs" — a real definition layer sitting *above* the mirror, not replacing it. Deploying a library connector creates the real Meta-side connection (via the mirror's own sync path) **and** a `connector_deployment` row, so "used by N agents" becomes a genuine `COUNT(*)` instead of the mirror's earlier stopgap heuristic (name + base_url match across agents — kept as a fallback for connectors created outside the library, since Meta itself has no cross-agent connector identity per `docs/meta-api/connectors.md`).

## Naming decision
The library-scoped row is named `Connector`, not `ConnectorTemplate` — checked against the Skills convention first: `Template` is reserved there for the *global curated catalog* (`SkillTemplate`), which Connectors has no equivalent of. A `ConnectorTemplate` name would have promised a catalog that doesn't exist.

## Next candidate for the same review (flagged, not built)
`Agent` today conflates "definition" and "deployed instance" the exact same way Connectors used to before this change — one row is simultaneously the reusable thing and its one live binding to a phone number. Applying this same 3-layer split to Agents is the logical next step, but it's a bigger architectural change than a same-session extension and needs its own PM/EM pass.

## Related
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
- [[../bugs-violations/agent-delete-cascade-missing-tables-2026-08-13|Agent delete cascade missing 3 tables]] — the delete path that had to catch up with this new schema
