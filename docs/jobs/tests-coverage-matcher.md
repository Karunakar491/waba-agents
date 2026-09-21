# Report coverage the specs actually have

## Job

Karunakar reads the UI inventory deciding where to spend testing effort; the
number it shows has to be true, because "2% covered" and "31% covered" lead to
completely different decisions and only one of them was real.

## Proof

- Before: 240 named controls, 5 covered (2%).
- After: same scan, 231 controls, 116 covered (50%) counting every spec on disk;
  230 controls, 71 covered (31%) counting only the 28 specs committed to master.
- The gap is 24 uncommitted spec files.
- Cause, confirmed by reading `edit-flows.spec.ts`: Playwright names are as often
  a regex as a string — `getByRole('button', { name: /^save|save changes|update/i })`
  — and the matcher read only quoted literals.

## Notes

The committed specs contain 84 `getByRole('button'` calls. A matcher reporting 5
covered controls against 84 button interactions was the signal something was
wrong with the tool, not the app.

Coverage is now documented as an upper bound in the generated files: names match
as strings, so two different "Continue" buttons on two screens both count as
driven by any spec clicking either. The uncovered column is the exact one.
