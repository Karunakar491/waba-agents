# Silent session renewal

## Job

Anyone using the app for longer than fifteen minutes keeps working. They come
back from a phone call, click the next thing, and it just happens — instead of
being dropped on the login screen with a half-filled agent wizard gone.

Karunakar specifically: he moves between the app and other work all day. Every
return trip currently costs him a login and whatever he had typed.

## Proof

A browser test that deletes only the `access_token` cookie — the exact state a
user is in at the fifteen-minute mark — then navigates and asserts the app
renewed the session instead of redirecting.

Run against production BEFORE the fix, it failed on the line that matters:

```
> 73 | expect(page.url(), 'was bounced to the login screen instead of renewing').not.toContain('/login')
```

After deploying, the same test passes and records exactly one `200` from
`/auth/refresh`.

8 unit tests on the single-flight rule, 56 frontend tests green, `tsc` 0.

## Notes

**The backend rotates refresh tokens and detects reuse.** Verified against the
live API: replaying a consumed refresh token returns `"Token reuse detected.
Session revoked."` and kills the session. So two refresh calls racing each
other are worse than no refresh at all — a naive "refresh on each 401" would
have made the bug it was fixing more severe.

That single fact shapes the whole design: exactly one refresh may be in flight,
and every other 401 waits on that same promise. The rule lives in
`authRefresh.ts` with the HTTP call injected, so it is testable without a
network or a bundler.

Cookies are shared across tabs while the guard is per-tab, so a second tab can
still have its token rejected as a replay. On a failed refresh the original
request is replayed once before signing anyone out, which distinguishes
"another tab already renewed it" from "genuinely logged out".

`/auth/login`, `/auth/logout`, `/auth/register` and `/auth/refresh` never
trigger a renewal — a 401 from login is a wrong password and the user has to
see it.

## Still missing

Nothing proactively renews before expiry, so the first request after the
fifteen-minute mark pays one extra round trip. Acceptable; a timer would add a
second refresh source and therefore a second chance to trip reuse detection.
