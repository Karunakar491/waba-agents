---
title: TSID for IDs
tags: [decisions, architecture, tsid]
date: 2026-07-16
---

# TSID for IDs

## Decision
All entity primary keys use TSIDs (time-sorted, 64-bit `BIGINT UNSIGNED`) via `TsidGenerator`, not auto-increment or UUID. Requires a `NODE_ID` environment variable (unique integer, 0-1023 per app instance) set before startup — see [[../deployment/lessons|deployment lesson #1]].

## The JS precision trap (confirmed bug, 2026-08-04)
TSID values routinely exceed JavaScript's `Number.MAX_SAFE_INTEGER` (2^53 - 1 ≈ 9.007×10^15) — a real generated ID looks like `867344591100000001` (18 digits). **Any DTO/response record that exposes an ID as a plain `Long` will have it silently corrupted in the browser** when JSON-parsed as a number (rounded to the nearest representable double).

## The Fix Pattern
Established first in `WabaResponse` (`backend/.../waba/dto/WabaDtos.java`):
```java
public record WabaResponse(
    String id, // TSID as string — 64-bit values exceed JS Number.MAX_SAFE_INTEGER
    ...
) {}
```
Convert at DTO construction time (`String.valueOf(entity.getId())`), or annotate an entity field directly if it's ever serialized raw:
```java
@JsonSerialize(using = ToStringSerializer.class)
private Long id;
```

## This Is NOT Automatic
Confirmed 2026-08-04: a first EL review pass on `IrisConversationService`'s new `SessionSummary`/`TurnResponse` records did not catch that both exposed `Long` id fields — even though the `WabaResponse` precedent already existed in the same codebase. **Every new response DTO with an entity ID needs an explicit check against this convention** — "we solved this once elsewhere" doesn't propagate automatically. See [[../bugs-violations/error-message-conflation-2026-08-04|post-mortem]].

## Checklist for any new response type carrying an ID
- [ ] Is the field typed `String`, not `Long`/`Integer`?
- [ ] If it must stay on an entity as `Long` (e.g. for JPA), is it annotated `@JsonSerialize(using = ToStringSerializer.class)`?
- [ ] Has a real ID value (not `1`, `2`, `3` in a test) been round-tripped through actual JSON to confirm no precision loss?
