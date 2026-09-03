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

## A 401 tells you nothing about a path

Probing endpoints while unauthenticated returns 401 for every path, including nonsense ones. It is not evidence a route exists.

---

## Related

- [[production-safety|Production Safety]] — the rules that don't bend
- [[process|Process & Gates]] — why the gates exist and where they failed
- [[deployment/lessons|Deployment Lessons]] — the server-specific list
