# FAQs in Knowledge Base, and the Skills columns that tell rows apart

## Job

Someone opens Knowledge Base to check what the agents know and finds files and
websites but no FAQs — the answers customers actually get — and someone
scanning the Skills Library sees rows that don't say which number they answer
on or when they were made; after this Knowledge Base has an FAQs tab, and Skills
carries Agent ID and Phone as their own columns plus filters for when a skill
was created and which number it is deployed on.

Founder, 2026-09-07: "In Skills Library, We will have these filters 1. Created
on 2. Deployed on (Phone numbers in a drop down) 3. Skills also should have 2
columns for agent id and phone number seperately (Same like how we have it in
agents)" and "FAQ's are still not visible in knowledge base".

## Proof

`tsc -b --force` clean. `jest` — 82 passed. `mvn -o package` clean.

Backend deployed 2026-09-07. Jar md5 `afdcc72de4c02fc35d369c6d1a354a5d`,
identical local and on the server; rollback kept as
`platform-ROLLBACK-20260907.jar`. Startup clean — "Successfully validated 55
migrations", "Schema is up to date. No migration necessary", "Started
PlatformApplication in 29.698 seconds", health 200 on the first poll after
restart. Nothing schema-level changed, so there was nothing to migrate.

Frontend bundle `index--EM9rw1U.js`, md5
`53801f77d67e400238788ced1e65d598`, identical local and on the server.

`e2e/skills-and-faqs.spec.ts` (`@skills-faqs`) — **3 passed** against
production, read-only:

- **Skills shows Agent ID, Phone and On agent as columns.** The ids begin
  `pfbid`, so it is Meta's agent id and not ours.
- **The Phone column holds no Meta phone number id.** Asserted as a negative —
  no cell is a bare run of twelve or more digits — because that is exactly the
  defect the Agents list already had fixed once.
- **Created and Deployed-on both filter**, and narrowing to the last 7 days
  removes rows and restoring the filter puts them back. The phone options are
  also asserted not to be raw ids.
- **Knowledge Base has an FAQs tab that loads with no failing request**, shows
  Question and Deployed on, and does not offer the upload panel.

Screenshot: `e2e-shots/kb-faqs.png` — real questions, real answers, each row
naming the number it answers on.

## Notes

**The phone number needed a second query.** The skills API returns Meta's
`phoneNumberId`; printing that in a column or a filter option would have
repeated the defect the Agents list had. The page fetches agents purely to map
`phoneNumberId` to a dialable number, and shows "Number not synced yet" when
there is no mapping rather than falling back to the id.

**"Created on" is a window, not a date.** Last 7 / 30 / 90 days. A date picker
would be more precise and slower to use, and the question behind the filter is
almost always "what changed recently".

**Both new Skills columns are empty for a Library skill**, deliberately. A
Library skill has no single owning agent — the agents it is live on are in its
deployments — so inventing a value there would be worse than an em dash.

**Two things fixed in passing.** The Knowledge Base agent picker read
`smsa (1249896194867775)`, an internal id where a phone number belongs; it now
shows the dialable number. And the upload panel used to render on every tab, so
the FAQs tab would have offered "Add a website to" — FAQs are written on an
agent's Knowledge tab, where editing them already has its own confirmations.

**The FAQ table is read-only, deliberately.** Editing an FAQ writes through to a
live agent immediately. A second, thinner editor here would be a second thing to
keep correct, against real customers.

**A test assertion that was wrong, not the code.** The first run failed claiming
the phone filter had no real options. The shared toolbar renders every option as
`"<label>: <value>"`, so all of them started with "Deployed on" and my filter
discarded the lot. Worth recording because the failure looked exactly like a
missing-data bug.
