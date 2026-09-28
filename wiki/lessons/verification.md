---
title: Verification — What Counts As Proof
tags: [lessons, verification, testing, deployment, proof]
---

# Verification — What Counts As Proof

> Every lesson here was learned the same way: something looked verified, wasn't, and shipped broken. The pattern is always a cheap signal standing in for an expensive one.

---

## A green health check does not mean your code is running

`/actuator/health` returning 200 after `systemctl restart` proves the JVM came up and can serve HTTP. It says **nothing about which code is inside it** — an old jar restarts just as cleanly and passes identically.

**Bit us twice, same night** (2026-08-04 and 2026-08-07): both times deploying to `/opt/metaagent/platform.jar` when systemd's real `ExecStart` is `/opt/metaagent/target/platform-0.1.0-SNAPSHOT.jar`. [[deployment/lessons|Deployment lesson #12]] already recorded it and it still recurred.

**Rule:** after every backend deploy, verify the *specific changed behaviour* live before reporting success. Never a health check alone.

## `mvn compile` without `clean` gives false passes

Stale classes in `target/` satisfy references to symbols that no longer exist. On 2026-09-03 this hid a missing repository finder that my own commit had introduced — `mvn compile` passed, `mvn clean compile` failed.

**Rule:** `mvn clean compile` before claiming a build is good.

## Static review does not catch execution errors

Every EL "APPROVE" in the 2026-08-03 session was an agent reading code and reasoning about it — no test suite ran. Consequence: `karix-mcp/schema.sql` used `row_number` as a bare column name, a reserved word in MySQL 8. Three rounds of review read that file and reasoned about it without catching a syntax error that any execution would have surfaced instantly.

**Rule:** reading SQL is not running SQL. Reading a parser is not feeding it a payload. State plainly when a review was static-only.

## Verify webhook shapes against real captured traffic

`OutboundEchoParser` was built to read `to`/`type`/`text.body` straight off `message_echoes[0]`, modelled on the sibling inbound `messages[0]` shape. The real payload nests the message one level deeper under a `message` key.

The parser silently no-op'd on **every** real echo — missing fields → empty string → null body → early return. Real BizAI replies went to real customers on WhatsApp and were never persisted, so the agent looked completely silent from inside our own product.

**Rule:** never trust a field path because it looks plausible or mirrors a sibling. Read a real row out of `webhook_raw` first. Especially anything nested under `standby`.

## `networkidle` is not "loaded"

An audit pass measured screen content right after `waitForLoadState('networkidle')` and reported three agent tabs as rendering nothing. All three work — they just finish after the first quiet moment in the network.

**Rule:** never claim a screen is empty from a text-length measurement. Add a real wait **and** save a screenshot, then look at it. A screenshot proves emptiness in a way a character count never does.

## `scp` exit 0 does not mean the bytes arrived

A 68.6 MB jar silently truncated to 34.7 MB, exit code 0, no warning. Deploying it crash-looped the service with "Invalid or corrupt jarfile".

**Rule:** after `scp`-ing any binary, compare size or checksum on both sides **before** moving it into the live path.

## Check migration numbers numerically

`ls db/migration | tail -5` sorts as strings, so `V9` sorts after `V36`. That landed a new migration on `V10`, colliding with an existing `V10__seed_demo_waba.sql` and crash-looping Flyway validation at boot.

**Rule:** `grep -oE 'V[0-9]+' | sort -n | tail -1`, never alphabetical.

## An audit spec that doesn't know the product's words invents defects

One run of `edit-flows.spec.ts` on 2026-09-18 produced three findings, and all
three were the spec's fault:

- it pointed at agent `875641528037412864`, deleted since, and spent its whole
  15-minute budget clicking a Settings tab on an "Agent not found" page;
- it looked for a save control matching `/^save|save changes|update/i`, so it
  reported "skill edit page offers no Save button" about a page whose button
  reads **Publish changes** (`SkillEditPage:184`);
- it looked for a row-level Edit button on the connector library, which is a
  workbench with click-to-edit rows, and reported "no Edit control on any
  connector".

Each one reads, in the report, exactly like a product defect.

**Rule:** before reporting that a control is missing, grep the component for
the label it actually renders. A negative finding from a selector is a claim
about the selector until the source says otherwise. And bound every `click()`
in an audit spec with a timeout — an unbounded wait converts a stale target
into a silent 15-minute loss.

## "The screen is right" hides what the screen quietly does

2026-09-24: three R4/R6 slices were live and reviewed as correct screens. The
first run that drove the wizard against the real app found that pressing Next on
the Business Persona step publishes the persona to the **live phone number** —
so creating an agent without typing anything replaces the business profile Meta
shows customers with blanks, and archives the real one. Every screenshot of that
step looked right, because nothing on screen says it publishes.

The proof was not in the UI at all. It was a read-only sweep of
`/business-profiles/live` and `/history` for every number afterwards, comparing
how many fields were filled before and after.

**Rule:** a screen that writes is not proven by looking at it. After driving a
journey, read back the state it wrote — for every record it could have touched,
not just the one you were looking at — and compare against what was there
before. The bug that matters is usually a write nobody asked for.

## A merge into the deploy branch ships whatever comes the other way

Merging a feature branch into the branch production is built from is not a
one-way move. Anything the deploy branch had that the feature branch lacked is
now in *your* bundle, and you are the one deploying it.

2026-09-24: merging R4/R6 into `fix/webhook-pipeline-unblock` pulled in
`7eae463`, which reads two new fields (`awaitingReply`, `waitingSince`) in
`InboxPage.tsx`. Had the matching backend not been live, the deploy would have
put an Inbox in front of real customers that asks the API for fields it does not
return — a screen nobody on this side changed, broken by a merge.

The git log was not enough to settle it either: that commit's timestamp is three
minutes *after* the running jar was built, because the jar was built from the
working tree and committed afterwards. It looked undeployed and was not.

**Rule:** before merging into the deploy line, run
`git log --oneline <feature>..<deploy-branch>` and account for every commit it
returns. If any touches the frontend, prove its backend is live **by reading the
running jar**, then run that feature's suites after the deploy even though it is
not your change.

## A 401 tells you nothing about a path

Probing endpoints while unauthenticated returns 401 for every path, including nonsense ones. It is not evidence a route exists.

## Never measure arrival with a table written after a filter

2026-09-24. The founder reported the Inbox showing only the customer's half of a live conversation. I counted rows in `webhook_raw` per day, found no agent replies after 21 September, and told him Meta had stopped sending them.

`webhook_raw` is written *after* two gates in `WebhookController` that discard a payload and return `200 OK` without persisting anything. I had measured our own deletions and read them as the other side's silence. nginx had logged 490 `POST /api/v1/webhook` that day against 69 rows kept — 86% discarded, agent replies among them.

He caught it, from the product rather than the code: *"how come KKs chat or any other chat has all these"*. Old threads looked complete because their messages were stored before the current behaviour, plus a backlog replay; only new conversations were one-sided. **A distribution that differs between old and new data is evidence about our code, not about the sender.**

The rule: to prove something did or did not arrive, count it at the edge — the webserver log, the sender's own dashboard — never at a table your own code decides what to write into. If the two numbers disagree, the gap is yours.

## A filter you cannot see the output of will be described wrongly

Same day, an hour later, and worth recording separately because the second mistake had the same shape as the first.

Having found the discarding gate, I told the founder which payloads it was eating. Reading the predicate properly afterwards: it only inspects **top-level** `value.statuses`, while the thing I claimed it was destroying arrives under `value.standby.message_echoes`, in a payload with no top-level statuses at all. It does destroy a related payload, so the conclusion was half right, which is worse than plainly wrong — it survives a casual check.

The supporting evidence was circular too. "245 of 300 retained payloads carry the tag" cannot show what a filter drops: retained payloads are by definition the ones it kept.

Two confident wrong answers in one day, both from reading code instead of data, both stated to the founder before being checked. The order that actually works: **make the drop observable, read a real dropped item, then change the rule.** A code path whose output nobody can inspect will be confidently mis-described, including by the person who just read it.

Corollary for building: a filter that discards without recording what it discarded and why is not finished. `log.debug` does not count — production does not run at debug, so it is the same as recording nothing.

## `flyway:validate` proves a deploy will boot before you ever restart the service

2026-09-28, deploying R8's business-event ledger. Production's migration
history had V56–V62 applied, but `master`'s migration folder was missing
V55–V58 outright (found only by listing the folder, since an earlier grep for
"V58+" missed the gap below it). Two live restarts crash-looped before this
was caught — Flyway's `FlywayValidateException` cascades into unrelated bean
failures (`Cannot resolve reference to bean 'jpaSharedEM_entityManagerFactory'`
for a repository that has nothing to do with migrations), so the surface
symptom points at the wrong subsystem entirely.

The fix that actually worked: run `mvn org.flywaydb:flyway-maven-plugin:validate`
against the production DB directly — read-only, no migrate, no app boot — with
the exact `db/migration` folder about to be deployed. It reports every
validation problem (missing-locally, checksum mismatch, pending) without ever
touching the running service. Confirmed clean *before* the restart that
finally worked cleanly on the first try.

**Rule:** before restarting a service whose boot includes a Flyway migration,
run `flyway:validate` read-only against the target database first. A crash
loop found this way costs one command; found by restarting production costs
minutes of downtime per attempt, and the stack trace lies about where the
problem is.

## A deleted-but-open file is still readable via `/proc/<pid>/fd/`

Same session: `mvn clean package` deletes `target/*.jar` before the new one
lands, and the currently-running systemd service has that exact deleted file
still open (`java -jar` keeps the ZipFile handle open for the process
lifetime). Losing the "before" jar you meant to snapshot as a rollback point
is recoverable on Linux as long as the process holding it hasn't restarted:
`ls -la /proc/<pid>/fd/` lists it as `(deleted)`, and `cp /proc/<pid>/fd/<n>
somewhere.jar` recovers the exact bytes.

**Rule:** capture the rollback copy of a running jar *before* running `mvn
clean`, not after — but if you forget, check `/proc/<pid>/fd/` before assuming
the old build is gone.

## A UI that "fails gracefully" can be hiding a real success

2026-09-28, same R8 deploy. After shipping the frontend, the Trigger Event
modal still showed "Meta accepted the event but returned no id to track its
status" on every fire — including ones the backend recorded as fully
`ACCEPTED` with a real Meta id and `meta_status=success`. The backend's
`fireResponse()` returned `agent_event_id`; the modal read `agentEventId`.
Neither side was new: the old direct-proxy path forwarded Meta's raw response
unmodified, and Meta's own field really is snake_case, so this exact mismatch
had been there since before R8 existed — it just never crashed, because the
frontend's fallback message reads as a plausible (if unhelpful) explanation
rather than an obvious bug.

**Rule:** when a UI shows a vague "didn't quite work" message, check the
underlying record before believing it — a fallback string that never throws
is indistinguishable, on screen, from a real failure. Compare what the
database says happened against what the screen says happened, for the exact
same event, not just for the class of event.

---

## Related

- [[production-safety|Production Safety]] — the rules that don't bend
- [[process|Process & Gates]] — why the gates exist and where they failed
- [[deployment/lessons|Deployment Lessons]] — the server-specific list
