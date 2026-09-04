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

Deployed 2026-09-04. Backend jar md5 `1387f883018056bfe52698e2c90e960c`, rollback
`/opt/metaagent/target/platform-ROLLBACK-20260904083738.jar`, "Started
PlatformApplication in 29.492 seconds", 54 migrations validated and none applied.
Frontend `index-lv9Xcox_.js`, served md5 `f9cd5fbfe40444500cf691d3bd40d019`
hash-matched against the local build, rollback
`/tmp/metaagent-backup-20260904083919.tar.gz`.

**1. Meta's real reason now reaches the operator.** Three real rejections against
production, each of which said only `Meta API error: 400` before this deploy:

```
duplicate input name -> Invalid request_definition — request_definition uses duplicate
                        top-level input name "action" in query_parameters and body.params.

nested inline object -> JSON Schema Validation Error — ... constraint 'patternProperties'
                        for the JSON field 'request_definition.body.params' ...

XML content type     -> JSON Schema Validation Error — ... constraint 'enum' for
                        'request_definition.body.content_type' ...
                        expected : '[application/json]' but got 'application/xml'
```

That last one is the point: the message now tells the operator the answer instead
of a number. None of the three created a tool; the IndiaMART connector still
holds only `product_search`.

**2. The Test response is readable.** Screenshot
`docs/e2e-test-runs/2026-09-04-xml-tool-run.png` reads
"Worked · the API answered HTTP 200 · application/xml" above the actual XML with
real angle brackets, raw envelope behind a disclosure.

Proven by browser test rather than by eye: `@xml-ui` previously asserted the
**escaped** form to pin the defect, and now asserts `<?xml version` and
`<slideshow` while requiring that no unicode escape reaches the operator. Passes
against production.

**3. `DELETE` with a body** is accepted by the editor and the serializer, covered
by two tests split along what the wire actually does.

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
