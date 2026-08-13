---
title: Agent Delete Cascade Missing 3 Tables — 2026-08-13
tags: [bug, backend, delete, connectors, post-mortem]
date: 2026-08-13
---

# Agent Delete Cascade Missing 3 Tables

## What Happened
`AgentService.deleteAgent()`'s local cascade (website pages → websites → faqs → skills → ui_skills → files → messages → conversations → webhook_raw → agent) was written before the connector-mirror (`V45`, `agent_connector`) and connector-library (`V46`, `connector_deployment`) features existed, and before `agent_skill_attachment` (Skill Library's per-agent attachment table) was wired to require cleanup here too. Nobody updated this cascade when those tables landed.

A real delete against any agent with connector or skill-library history threw a live Hibernate exception:

```
Caused by: org.hibernate.exception.ConstraintViolationException: could not execute statement
[Cannot delete or update a parent row: a foreign key constraint fails
(`meta_agent_db`.`agent_connector`, CONSTRAINT `fk_agent_connector_agent`
FOREIGN KEY (`agent_id`) REFERENCES `agent` (`id`))] [delete from agent where id=?]
```

## How It Surfaced
Live end-to-end testing of the actual agent-deploy flow (2026-08-13 session) — deliberately reusing already-connected phone numbers by first tearing down the agent occupying each one, via the real `DELETE /agents/{id}` endpoint. First real call against an agent with connector history hit this immediately.

## Fix
Added `@Modifying void deleteAllByAgentId(Long agentId)` to `AgentConnectorRepository`, `ConnectorDeploymentRepository`, and `AgentSkillAttachmentRepository`, and wired all three into `AgentService.deleteAgent()`'s cascade — `connectorDeploymentRepository` and `agentConnectorRepository` before the FK-affected row, `agentSkillAttachmentRepository` alongside the existing `agentSkillRepository` call. No FK ordering conflict between the three added deletes and the rest of the cascade.

Verified live, twice, against real Meta after the fix: `metaFullyCleaned: true` both times, one deleting 11 real skills, the other 23 skills plus a real connector.

## Rule to Remember
> Any new child table added to an entity that already has a delete cascade must be added to that cascade in the SAME change — a schema addition and its owning entity's delete path are one unit of work, not two. `grep` the entity's existing delete method for every new `@Entity` with a `@ManyToOne`/FK back to it before considering a schema-adding task done.

## Related
- [[../decisions/reusable-library-over-meta-execution-2026-08-13|Reusable library over Meta execution]] — the feature whose schema additions exposed this
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
