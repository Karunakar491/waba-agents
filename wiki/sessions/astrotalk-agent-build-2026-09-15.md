---
date: 2026-09-15
type: task
tags: [astrotalk, agent-build, connectors, skills, ui-only, verification]
status: active
---

# Astrotalk Agent Build (2026-09-15)

## Context

The founder asked for an Astrotalk agent, built **entirely through the product's own
UI**, against production. Inputs: an interactive WhatsApp journey prototype (a
10-step Hinglish flow — marketing hook, four-exchange teasing discovery, concern
list, ranked astrologers, booking), two API contracts (the combined general Kundli
report and an astrologer recommendation endpoint), and a live API key for the
recommendation API.

An Astrotalk agent already existed, created ~5h earlier: `887643060282855424` on
**+91 96422 01123**, status Draft, effectively empty. It was continued, not
duplicated.

## What was done

Everything through the UI, driven by Playwright against `app.karix.online`.
Content lives in `docs/jobs/astrotalk-agent-2026-09-15.json` as prose, not string
literals, so it can be reviewed as writing — same pattern as the IndiaMART skillset.

- **2 connectors** in the library, actions created by pasting the real cURL:
  - `Astrotalk Kundli API` → `https://api.kundali.astrotalk.com`, action
    `general_kundli` (POST `/v1/combined/general`), no auth.
  - `Astrotalk Astrologer Recommendation` → `https://api.paidchat.astrotalk.com`,
    action `recommend_astrologers`, auth `API_KEY` header `X-Api-Key`.
  - Both published onto the agent, both **ACTIVE**. On the agent they carry
    slugified Meta names: `astrotalk_kundli_api`, `astrotalk_astrologer_recommendation`.
- **7 conversational skills**, published: `birth-details-collection`,
  `teasing-discovery`, `concern-capture`, `astrologer-recommendation`,
  `using-the-kundli-report`, `guardrails`, `conversation-limits`.
- **6 FAQs** in the knowledge base (Hinglish: pricing, unknown birth time, AI vs
  human, data privacy, refunds, languages).
- **Business persona** rewritten from a wrong-company draft to Astrotalk. Saved as
  a **draft, not deployed** — Deploy replaces what is live on Meta.

Specs kept (scripted operator sessions, not app tests):
`frontend/e2e/tools/astrotalk-{connectors,agent,publish-connectors,verify,send}.spec.ts`.

## Proof, not assertion

- `@astro-verify` reads the agent back from its own tabs: 7 skills in *Published
  skills*, 6 FAQ rows, both connectors ACTIVE, persona draft present, agent still
  Draft. Screenshot per tab in `frontend/e2e-shots/astrotalk-*.png`.
- `@astro-send` pressed Send on both actions against the real APIs:
  `general_kundli` returned a full chart; `recommend_astrologers` returned **200**
  with a real astrologer profile using the supplied key. A first attempt without
  the credential returned an honest `401 AUTH_FAILED`, and one without a body
  returned `422 body: Field required` — both useful, both the workbench telling
  the truth.
- `npx tsc --noEmit` clean.

## Where the line was drawn

**Publish & Test was never pressed.** It puts the agent live on +91 96422 01123 and
starts it answering real customers — the founder's call, not a build step. The
persona draft was likewise saved and not deployed.

The API key was passed as `ASTROTALK_API_KEY` on the command line only. It is not
in the repository, and the product does not store it either: the library holds the
header NAME, the value is typed at publish and forwarded to Meta, and the
workbench's per-call credential is "gone when you leave this page".

## Findings worth acting on

- The **persona editor's eight fields carry no addressable label** — 0 of 8 resolve
  by `getByLabel`. They had to be filled by position, guarded by asserting the
  first field's existing value. An a11y gap and a fragility trap.
- **Adding a FAQ duplicated an earlier FAQ row** once (`Kitna charge lagta hai?`
  twice) while the second was being added. Removed via Unpublish on the second
  copy. FAQ creation is also **eventually consistent** — a row can take well over
  30s to appear, so a short assertion fails a write that in fact succeeded.
- **Save draft on the persona fires no toast**, so there is no confirmation to wait
  on; the saved draft itself is the only signal.
- The connector Publish dialog's agent dropdown groups Astrotalk under
  **+91 91520 04283** while the agent is actually on **+91 96422 01123**. Worth a
  look — either the grouping is wrong or something is mismatched.
- `kaisa-yog-entry-list` (pre-existing, enabled) hardcodes the "18 Saal Baad" hook,
  so anyone arriving from a different creative gets a mismatched opener.

## Open, needs the founder

- **Deploy the persona?** Astrotalk text is a draft; Meta still has the previous
  published version.
- **Publish & Test?** Nothing about this agent is testable end to end otherwise —
  there is still no test WABA.
- **Kundli API needs lat/lon**, and the conversation only ever collects a city
  name. The action tells the model to supply coordinates for the named city: fine
  for cities it knows, drifting for small towns. A geocoding step or a
  city→coords lookup on Astrotalk's side would make it exact.
- **Contact email and Address left blank** in the persona on purpose — inventing a
  support address puts a fake one in front of customers.
- Journey steps 7–10 (payment, live session, top-up, rating) have no API contract
  yet, so nothing was built for them.

## Related

- [[lessons/verification|Verification]] — what counts as proof
- [[lessons/production-safety|Production safety]]
- [[sessions/history-timeline|History timeline]]
