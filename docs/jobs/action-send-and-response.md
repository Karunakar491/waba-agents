# Send the request, show the response

## Job

An action can be configured but never tried. The Response tab says testing is
impossible because "Meta makes the call, not us" — which was my claim, and it
was wrong. Meta making the call at runtime says nothing about whether we can
make one for verification. Today the first proof an action works is a real
customer's message failing.

Make Send real: the operator presses Send on the request bar, we make that exact
HTTP call server-side, and the Response tab shows status, latency, size, headers
and body.

## Why this is a backend job

- **CORS.** A browser cannot call a third-party API and read the response. The
  call has to be proxied.
- **SSRF.** A field where a user types a URL and the server fetches it is the
  textbook SSRF hole. On this box, `169.254.169.254` would hand out the
  instance's IAM credentials. The guard belongs on the server, where it cannot
  be skipped by editing the request in devtools.

## Design

`POST /api/v1/connector-library/{connectorId}/actions/probe`

Request: `{ method, path, queryParams{}, headers{}, body?, secrets{} }`.
Base URL is read from the stored connector — **never** taken from the request —
so the operator cannot point this at an arbitrary host by editing the payload.
The path is resolved against it and must stay under it.

`secrets` exists because credential values are deliberately not stored: they are
typed at publish time and never persisted. So a test call cannot authenticate
unless the operator supplies the value for this one call. It is used in memory,
never written to the database, never logged, and the response is never logged
either.

### The guard, in order

1. Scheme must be `http` or `https`.
2. Resolve the host to its addresses BEFORE connecting, and reject loopback,
   private ranges (RFC1918), link-local (`169.254/16` — the metadata endpoint),
   unique-local IPv6, `0.0.0.0/8`, and the mapped-IPv4 forms of all of them.
3. Connect to the resolved address that was checked, not by re-resolving the
   name — otherwise a DNS entry that answers twice defeats step 2.
4. Follow no redirects. A 302 to `169.254.169.254` is the whole attack.
5. Timeout 10s, response body capped at 256KB, one probe at a time per user.
6. `POST` only, authenticated, and the connector must belong to the caller's
   WABA — the same check every other connector endpoint makes.

### What the UI does with it

The Response tab shows status, latency, size, headers and pretty-printed body.
Two honesty requirements, both from things this product has already got wrong:

- **A 200 is not success.** The Kundli API returns `200` with
  `{"status":"failed"}`. The response pane says "read the status field, not the
  code" whenever a 2xx body carries a falsy `status`/`success`/`error` field.
- **This proves the API answers, not that the agent will call it correctly.**
  The pane says so. Nothing here instantiates the action on Meta.

## Proof

- Unit tests on the guard, and they are the point of this job: loopback,
  `169.254.169.254`, `10.x`, `127.0.0.1` spelled as `2130706433` and as
  `[::ffff:127.0.0.1]`, a hostname resolving to a private address, a redirect
  to a private address, an over-size body, a timeout.
- `mvn clean test` on the module — `clean`, because compile without it gives
  false passes here.
- A real probe against a real public API from the deployed box, and one against
  `169.254.169.254` proving it is refused rather than answered.
- Playwright: Send on a saved action shows a response; the 200-with-failed
  warning appears when the body says so.

## Kill switch

Behind a feature flag, default off. The endpoint is new, so nothing regresses
when it is off; turning it off removes the outbound-request capability entirely
without a code rollback.

## Not in this job

Import cURL (T27), the JSON validator/beautifier (T28), and folding
ToolParamsEditor and ToolBodyEditor into one component (T1). All are layout;
this is the one that changes whether the product can be trusted.
