# Phase 0 — stop the connector UI lying

## Job

Whoever is connecting a business API opens the tool editor deciding "did that
work, and if not what do I change?"; today a failure says `Meta API error: 400`
and a success prints an unreadable escaped envelope, so they see a status code
and a wall of `\u003C` — after this they see Meta's actual sentence and the real
response body.

## Proof

### Produced at commit time

Backend: `MetaApiErrorMessageTest` — **8 passed**. Every payload in it was
captured from `api_call_log` on 2026-09-04, so the test asserts against real Meta
responses rather than invented ones. `mvn -o compile` clean.

Frontend: **71 passed** across 6 suites, `tsc -b` clean, oxlint clean on the
touched files. New `describeToolRun.test.ts` (7 tests) uses real run envelopes
from production.

The three behaviour changes and the evidence each rests on:

- **Meta's reason is returned.** `MetaApiException` now has its own handler; it
  used to fall through to `handleBusiness`, which returned `"Meta API error: " +
  statusCode` while the real text sat unused in `responseBody`. Instead of `400`
  the operator now gets, verbatim from Meta:
  `request_definition uses duplicate top-level input name "action" in query_parameters and body.params.`
- **The Test response is readable.** `describeToolRun` unwraps the
  three-deep envelope to `output.data`, prints a string as text and an object
  pretty-printed, and shows the API's HTTP status and content type. The raw
  envelope stays behind a disclosure.
- **`DELETE` may carry a body.** Verified on the wire through Meta's runtime
  against httpbin: a DELETE body is delivered, a GET body is silently dropped.
  The old single test asserted "never emits body for GET or DELETE" — half wrong,
  now two tests, each matching observed behaviour.

### Produced against the running app

Filled in after deploy: a screenshot of the Test panel showing a readable
response, and a real failed save showing Meta's sentence instead of a number.

## Notes

First phase of `docs/superpowers/specs/2026-09-04-connector-edit-page-design.md`.
The edit page is built on top of this deliberately — it presents request,
response and errors, and none of those should be built on a layer that misreports
what happened.

`BusinessProfileTab.tsx` is modified in the working tree and is NOT part of this
job. It predates the session and has never been committed or tested.

Not done here, from the same phase: the four different verbs for saving
("Publish connector", "Add", "Publish changes", "Publish & Test"). That is a copy
decision across several screens, not a bug fix, and belongs with the page work.
