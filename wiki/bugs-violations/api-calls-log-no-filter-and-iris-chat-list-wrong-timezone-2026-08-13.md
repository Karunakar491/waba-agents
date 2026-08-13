---
title: API Calls Log Had No Filter + Iris Chat List Showed Wrong Timezone — 2026-08-13
tags: [bug, reports, timezone, ist, fixed]
date: 2026-08-13
---

# API Calls Log Had No Filter + Iris Chat List Showed Wrong Timezone

## What was wrong

1. **Reports → API Calls had no way to isolate anything.** `ReportsService.getApiCallLog` returned only the most-recent 100–200 rows account-wide, newest first, with no filter by path, method, status, or date. `GlobalSyncScheduler`'s routine background reconciliation (`GET agent_config/websites`/`files`/etc., across every agent, every few minutes) floods this list — real failures from hours earlier (e.g. the connector-creation bug, see [[connector-creation-never-succeeds-2026-08-13|writeup]]) were genuinely logged in `api_call_log` but invisible in the UI, buried past the row-200 cutoff with no way to search for them.

2. **`TemplateIrisAllChatsPage.tsx` showed the wrong time entirely.** Its `formatTimestamp`/`groupByRecency` used raw `new Date(iso)` and `toLocaleTimeString(undefined, ...)`/`toDateString()` — the exact bug class already fixed everywhere else in the app on 2026-08-07 (see `frontend/src/lib/dateFormat.ts`'s own header comment), but this file was never migrated onto the shared fix. Two independent problems stacked: `calledAt`/`updatedAt` strings from the backend are naive UTC with no `Z` suffix, so raw `new Date(iso)` parses them as browser-local time (silently wrong by whatever offset the viewing machine happens to be in); and even a correctly-parsed instant was then formatted/bucketed using the viewer's own OS timezone, not India's — for an India-only product, that's wrong regardless of whether the viewer happens to be in India or not, because "Today" should mean the same thing to every operator looking at the same data.

## The fix

- **Filters**: new `ApiCallLogFilter` record + `Specification<ApiCallLog>` (method, path-contains, outcome ALL/SUCCESS/ERROR, from/to) — `ApiCallLogRepository` now also extends `JpaSpecificationExecutor`. `GET /reports/api-calls` takes `method`, `pathContains`, `outcome`, `from`, `to`. Frontend (`ReportsPage.tsx`) gets preset chips (Connectors/Skills/Files/Websites/FAQ/Settings/Allowlist/Events/Eval/Persona — the same words already used in this app's own nav, not Meta's raw path names guessed cold), a free-text path box, a method dropdown, an outcome dropdown, and two `datetime-local` range inputs. Rows now show full date+time (`formatDateTimeIST`), not just time — a filtered range spanning days needs the date visible.
- **A near-miss caught while building the filter itself**: the two `datetime-local` inputs are labeled "(IST)" but an HTML `datetime-local` value carries no timezone information at all — it's exactly the raw string the operator typed. Sending that straight to the backend as if it were already UTC (which is what `calledAt` is stored as) would have shipped a *second* instance of the same timezone bug inside the very fix meant to help find timezone-adjacent problems. Added `istInputToUtcNaiveIso` to `dateFormat.ts` — interprets the typed value as IST explicitly (fixed +05:30, no DST) and converts to the naive-UTC shape `calledAt` is actually stored in, before it ever leaves the browser.
- **Iris chat list**: `TemplateIrisAllChatsPage.tsx` now uses `parseAsUtc` (already existed, now exported), `formatTimeIST` (already existed), and a new `istStartOfDayMs` helper (IST calendar-day boundary via `Intl.DateTimeFormat` with `timeZone: 'Asia/Kolkata'`, not the viewer's OS midnight) for both the Today/Yesterday/Previous-7-days bucketing and the displayed time/date.

## Verification
- `mvn -q -o compile` (backend) — clean, no output.
- `npx tsc --noEmit` (frontend) — exit 0.
- `npm run build` (frontend) — succeeded; only pre-existing, unrelated warnings (chunk size, one dynamic-import note on an untouched file).

## Related
- [[../decisions/draft-publish-settings-and-audience-shipped-2026-08-13|Draft/Publish for Settings + Audience]] — same session, same "verify against the real code before trusting a prior claim" discipline
- [[connector-creation-never-succeeds-2026-08-13|Connector creation never succeeds]] — the specific failure this filter was built to be able to find
- [[../sessions/session-2026-08-13|Session 2026-08-13]]
