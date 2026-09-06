---
title: Bugs & Violations
tags: [bugs, violations, index]
---

# Bugs & Violations

## CLAUDE.md Violations (process)
- [[violations-2026-07-20|Session 2026-07-20]] — EL gate skipped, knowledge index late, memory not updated, Karpathy ignored

## Bug Post-Mortems
- [[bug-dark-mode-accent|Dark Mode Accent Bug]] — `--accent` in `.dark` collapsed to muted (EL caught)
- [[bug-application-yml-overwrite|application.yml Overwrite]] — SCP overwrote server config, broke deploy
- [[error-message-conflation-2026-08-04|ProtectedRoute Error-Message Conflation]] — "no modules" and "fetch failed" show the identical lock screen; plus a self-caught TSID serialization bug in Iris session DTOs
- [[agent-delete-cascade-missing-tables-2026-08-13|Agent Delete Cascade Missing 3 Tables]] — new connector/skill-attachment tables never added to the existing delete cascade; found and fixed via live testing against real Meta
- [[hard-delete-migration-never-touches-meta-2026-08-13|Hard-Delete Migration Never Touches Meta]] — a demo-data cleanup migration deleted local rows but left every agent still live on Meta's side
- [[concurrent-agent-collision-2026-08-13|Concurrent Background-Agent Collision]] — two background agents on the same task overwrote each other's work; one self-detected and aborted cleanly
- [[connector-creation-never-succeeds-2026-08-13|Connector Creation Never Succeeds Against Real Meta]] — RESOLVED same day, 3 real Meta validation bugs found and fixed: stale flat `auth_config` shape, `auth_config` required even for `NONE`, connector `name` must be a plain identifier (no spaces/parens); live-verified on MDH (Shopify connector, ACTIVE) and IndiaMART (`indiamart_pricing_api`, LIVE)
- [[api-calls-log-no-filter-and-iris-chat-list-wrong-timezone-2026-08-13|API Calls Log Had No Filter + Iris Chat List Wrong Timezone]] — real connector failures were logged but unfindable in the Reports UI; Iris chat list used raw browser-timezone parsing instead of the shared IST fix; both fixed
- [[agents-list-showed-raw-meta-phone-id-2026-08-13|Agents List Showed Meta's Raw Internal Phone ID]] — Agents list/detail page showed the internal phoneNumberId instead of the real number; PhoneNumberSnapshot.displayPhoneNumber existed but was never joined in; fixed
- [[bizai-active-messages-never-persisted-2026-08-13|BizAI-Active Customer Messages Never Persisted to Conversations]] — CRITICAL: every message sent to a live, Meta-AI-handled agent (the normal case for the whole product) was silently dropped from Conversations; parser only read the top-level webhook path, never the `standby`-wrapped path Meta actually uses when its own AI is responding; fixed and deployed to production
- [[outbound-echo-text-never-parsed-2026-08-13|AI Reply Text Never Persisted (Outbound Echo Not Parsed)]] — sibling/follow-up to the above: outbound Message row was created from the `sent` status webhook but content hard-coded null; real text lives in `value.standby.message_echoes[]`, now parsed and wired in; fixed and deployed to production
- [[echo-parser-wrong-nesting-2026-08-13|Outbound Echo Parser Read the Wrong JSON Level]] — the fix above still didn't work: it read the echo's fields from the wrong nesting level (a never-verified guess), so real BizAI replies to a real customer were sent but silently never persisted, hours later, caught only by comparing a real WhatsApp transcript against our own DB; fixed with the verified real shape + a defensive flat-shape fallback added on top since Meta's shapes have now proven unreliable to assume twice
- [[status-update-missing-standby-nesting-2026-08-16|StatusUpdateParser Missed the standby-Nested Shape]] — THIRD instance of the same pattern: delivery-status updates for BizAI-owned conversations were silently dropped server-side, not just mislabeled in the UI; fixed with the same standby-fallback pattern already used for the two bugs above
- [[echo-reliability-gap-2026-08-16|Message Echoes Stop Arriving Entirely (UNRESOLVED)]] — CRITICAL, open: unlike the parsing bugs above, this is a genuine Meta-side delivery reliability gap — message_echoes (the only source for the AI's actual reply text) arrived reliably for hours then stopped entirely for a real conversation, with no code/config change on our side; needs Meta Developer Tools MCP investigation next session
- [[inbound-button-type-not-parsed-2026-08-17|Inbound button-type Messages Not Parsed]] — OPEN: `InboundMessageParser` has no branch for `type: "button"` (quick-reply/CTA taps), found via real Meta example payloads; message persists but Inbox shows it blank
- [[disk-full-app-log-2026-09-06|Root Volume Full Again — app.log Reached 12G]] — RESOLVED: third disk-full from the same unrotated file (after 2026-08-13 and 2026-08-25); a routine deploy failed on 0 bytes free with app.log at 12G of a 20G volume, driven by a RabbitMQ reconnect loop; the real failure is that a known one-file logrotate fix stayed open across two prior outages — now installed with copytruncate + maxsize 500M and proven by forcing a rotation against the live open file

## Resolved TASKS (22 total — all done)
See [[../docs/tasks|TASKS]] for full list. Key ones:
- TASK-001: `systemPrompt` missing on Agent entity
- TASK-002: SecurityContext in RabbitMQ thread
- TASK-003: JWT not in httpOnly cookie
- TASK-006: `account_id` missing on 5 child entities
- TASK-021: Claude in message pipeline (deleted)
