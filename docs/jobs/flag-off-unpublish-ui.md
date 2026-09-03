# Put the Unpublish UI behind a flag, default off

## Job

An operator opens an agent's Skills, UI Skills or FAQ tab deciding what to
change; they see exactly what they see today — no Unpublish button, no Drafts
section — because the feature is committed for buildability but switched off
until its four recorded findings are closed.

The deploy audience is really Karunakar: he opens the deploy record deciding
whether production is traceable, and sees a bundle that maps to an exact commit
for the first time since 2026-08-25.

## Proof

**The proof method written here first was wrong** and is kept for the record. I
planned to show `grep -oh 'Unpublish' assets/*.js | wc -l` → 0 after the
deploy. It returns **12**: the flag is a runtime guard, so the button markup and
label strings still ship in the bundle — they are simply never rendered. A
string count cannot distinguish "absent" from "present but dark".

The real proof is the compiled constant, read out of the **bytes actually being
served** from `app.karix.online`:

```
function Am(e){return e===`true`}
var jm=Am(void 0);
...
children:[jm&&(0,Y.jsx)(`button`,{onClick:()=>y(e),title:`Unpublish — pull it off Meta …
```

`jm = (undefined === 'true')` → `false`, and every Unpublish button is guarded
by `jm &&`. Definitive, not inferred.

Served-asset md5 `c6bafc7c62a8c34fc7db51d1ef04fe3e` — exact match to the local
build. Full transcript in
[docs/e2e-test-runs/2026-09-03-master-deploy.md](../e2e-test-runs/2026-09-03-master-deploy.md).

Still not proven: nobody has loaded the page in a browser. Byte-level proof
shows the guard is false; it does not show the app renders correctly. That gap
closes only with Playwright or a human look.

## Notes

Why off: TASKS.md #18 records four findings against this feature that are not
addressed — unsafe Delete asymmetry, no feature flag, wrong button styling,
diff-size violation. I landed the components to repair the master build
(commits `4d41ad3`..`6c9928c`) without closing them, so the flag is what keeps
that from becoming a user-visible change.

The Delete asymmetry is confirmed by reading the code, not just inherited from
the note: in all three panels the irreversible Delete fires straight from
`onClick` with no confirmation, while the *reversible* Unpublish gets a confirm
modal. That is backwards and should be fixed before the flag is turned on.

Flag lives in `frontend/src/lib/featureFlags.ts`, defaults off when the env var
is unset, and is build-time — so flipping it is a static-file rebuild and swap,
no service restart and no database involvement, which keeps it inside the Kill
Switch's five-minute rule.

Backend endpoints and the V54 schema are already live in production (V54 and
V55 were applied 2026-08-20), so nothing is half-wired: the API exists, only the
UI is dark.

Guard placed inside `DraftsDisclosure` rather than at its three call sites, so
the flag cannot be honoured in two panels and forgotten in the third. The three
Unpublish buttons are guarded individually because they live in their own
panels.
