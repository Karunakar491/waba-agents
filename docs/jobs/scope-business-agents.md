# Scope the product to Business Agents

## Job

Karunakar opens the UI inventory deciding where testing effort goes, and the
percentage answers a question about the thing being built — not one diluted by a
module he has stopped investing in.

## Proof

`node scripts/ui-inventory.js`:

```
27 routes
182 named controls, 96 covered (53%)
73 with no accessible name
```

Before, with Template Studio counted: 231 controls, 116 covered, 82 unnamed.
The 49 Template Studio controls now sit in their own area file marked
_(out of scope)_ and are excluded from the headline.

## Notes

Founder, 2026-09-21: *"Ignore template studio completely. Lets focus on Business
Agents as a feature."*

Excluded, not deleted. `/templates/*` is still 5 of 27 routes and still ships to
users, so a regression there is still a regression — the area file keeps being
generated so nobody has to discover that the hard way. What it loses is new work,
new tests, and a place in the number that drives decisions.
