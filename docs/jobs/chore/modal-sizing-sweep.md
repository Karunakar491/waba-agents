# Modal sizing sweep

## Job

Anyone opening any dialog in the app decides faster when the content isn't
cramped; the shared default widens from `max-w-md` to `max-w-lg`, with
per-dialog bumps where the content warranted it.

## Proof

Filed as `chore/` — **exemption recorded deliberately, not to dodge the gate.**
This is a pure sizing change across a dozen dialogs. Its only real verification
is a human looking at each dialog, and there is still no browser automation in
this repo to capture that. `npx tsc --noEmit` exit 0 is the whole of the
machine-checkable evidence.

When Playwright lands, this is exactly the kind of change a screenshot suite
should cover.

## Notes

Not attached to any of the features deployed alongside it, but it rides in the
same bundle, so it will be the first visible difference on deploy — every
dialog in the app gets wider. Worth knowing before someone reports it as a
regression.

Touches twelve files with one line each. No logic.
