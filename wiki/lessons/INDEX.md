---
title: Lessons
tags: [lessons, index]
---

# Lessons

> Durable, reusable rules — the ones that apply to the next task, not a record of what happened on a given day. Dated history lives in [[sessions/INDEX|Sessions]] and [[bugs-violations/INDEX|Bugs & Violations]].
>
> Consolidated here on 2026-09-04 from 32 separate agent-memory files, because the memory index had grown to the point where it was crowding out the things worth remembering.

| Page | What it covers |
|---|---|
| [[verification\|Verification]] | What counts as proof: health checks, static review, `mvn clean`, real webhook payloads, `networkidle`, `scp` sizes, migration numbering |
| [[production-safety\|Production Safety]] | The rules that don't bend: production data, no raw SQL, config overwrites, the kill switch |
| [[process\|Process & Working Style]] | The bible, no cheap fixes, product-first, reviewing against docs not implementation, keeping replies short |
| [[frontend-patterns\|Frontend Patterns]] | Unmount races, stale effect deps, nested card chrome, TSID serialization, Vite build-time env, the auth response shape |
| [[backend-patterns\|Backend Patterns]] | Lombok constructors, test placement, scheduled jobs in tests, Testcontainers reuse, guarding the right condition |

---

## The one-line version

- A cheap signal standing in for an expensive one is how every verification failure here happened.
- Production data is a higher tier than any gate approval.
- "Go ahead" is about **what** to build, never about **how**.
- Withdraw wrong claims out loud; a false finding costs more trust than a missed one.
