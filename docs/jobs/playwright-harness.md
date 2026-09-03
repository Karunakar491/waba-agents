# Browser testing harness

## Job

Anyone reviewing a UI change decides whether to trust it; they see a browser
actually load the deployed screen and assert on what rendered, instead of
taking "tsc passed, looks right" as evidence.

Karunakar specifically: he opens a deploy record deciding whether the feature
works, and sees a browser result rather than my description of the code.

## Proof

`npx playwright test` against production, real Chromium:

```
  ok 1  app shell loads and mounts React (8.2s)
  ok 2  login screen is reachable and offers a way in (3.0s)
  ok 3  bundle does not point at localhost — the dead-app trap (5.1s)
  ok 4  no console errors or failed requests on first paint (3.7s)
  ok 5  Unpublish UI is dark in production — proves the feature flag (2.6s)
  5 passed (29.1s)
```

Full run with the authenticated specs present: **5 passed, 5 skipped** — the
authed specs skip with "Set APP_USER and APP_PASSWORD…" rather than failing.
`tsc --noEmit` exit 0.

This is the first browser-verified evidence in this repository.

## Notes

`playwright` was already approved in TECH-STACK.md ("E2E tests — critical user
flows only") and had simply never been installed. Nothing was added to the
stack; a listed tool was finally made real. Version 1.62.1, Chromium only.

**Read-only against production, deliberately.** Default `baseURL` is
`https://app.karix.online` because there is still no staging environment. Every
test navigates and reads; none creates, edits or deletes. A test that mutated
would be changing real customer-facing data to prove a button exists. Mutating
coverage waits for a test environment.

**No credentials committed.** They come from `APP_USER` / `APP_PASSWORD` or
`frontend/.env.e2e`, already covered by the existing `.env.*` gitignore rule.
Missing credentials cause a **skip with a reason**, never a failure — a red
suite that means "you forgot a password" trains people to ignore red, which is
worse than having no suite.

Three of the five passing tests encode real incidents rather than generic
checks:

- *dead-app trap* — `frontend/.env.production` is gitignored, so a build made
  without it ships an app whose API base is `localhost:8080`. It looks perfectly
  healthy to `curl`. This test asserts no bundle contains that string.
- *mounts React* — a white page with HTTP 200 passes every `curl` check and
  fails every human. Asserts `#root` actually has children.
- *Unpublish UI is dark* — standing regression guard on the feature flag from
  batch 1, so it can't be switched on by accident while its four findings are
  open.

## Still missing

The authenticated audit — the job-by-job walk that started this whole
conversation — needs production credentials, which I don't have. Five specs are
written and waiting for them.

Nothing here tests Meta. No test WABA still exists, so agent behaviour end to
end remains unverifiable.
