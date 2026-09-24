# Read Meta's own docs instead of waiting to be sent them

## Job

Someone building the shared Knowledge and Persona screens decides what fields to
put on them. They read `docs/meta-api/` and get Meta's current contract rather
than one from July — so the form they build matches what Meta actually accepts,
and the gaps between the two are written down instead of discovered by a failing
upload.

Founder, 2026-09-24: *"What all Meta docs would you need, If I paste Meta URL
cant you read?"* — and yes. The docs are public, indexed at
`developers.facebook.com/documentation/meta-business-agent/llms.txt`, and every
page is served as markdown by appending `.md`. Slice 0 of R4/R6 was recorded as
"blocked on the founder pasting them"; that was my assumption and it was wrong.

## Proof

All five stale pages fetched from Meta 2026-09-24 and diffed against ours.
Nothing in `docs/meta-api/` is now stale on a date.

| File | What the re-read changed |
|---|---|
| business_info.md | Schema unchanged. PUT overwrites only *provided* fields — so `""` overwrites and an absent field does not, which is exactly the bug fixed today. `contact_info` is null when unconfigured. Instagram scope added |
| websites.md | **Five writable fields we never offer** — `single_urls` and the include/exclude sub-domain and URL-pattern pairs. `crawl_status` has six values, not the four we had. `crawl_error` exists and we never read it |
| files.md | Meta checks file content against the extension in `file_name`. 409 and 503 were missing. Max is 100,000,000 bytes decimal, not 100 MiB |
| faq.md | Schema verified unchanged. 409 Conflict was missing, and our add path saves locally on any failure — so a 409 strands an FAQ Meta will never accept |
| agent-test.md | Schema was already complete. Rate limits are new: 500/hr per number, 10,000/hr per app, plus 404 |

The page-to-file mapping for all 23 files is now in `docs/meta-api/INDEX.md`,
along with the eleven pages Meta publishes that we have no file for at all.

### Not done

- The eleven unread pages, including `usage-guides/writing-ui-skills.md`, which
  is directly about the rich-message work shipped this morning.
- No code changed. Every gap above is recorded, none is fixed.
- The fetch returns a model's reading of the page, not the raw bytes. For the
  four schemas that were already correct that is good enough; where it matters
  in an argument, a dated paste is still better evidence.

## Notes

- **Two of these gaps are the same shape as bugs already found today**: a status
  value Meta sets and we never read (`completed_no_data`, `crawl_error`) is the
  `blocked` skill problem again, and "the wizard offers one field where Meta
  takes six" is the persona problem again.
- `agent_test` is the only way to exercise an agent's real answers without
  messaging a person, it is explicitly not billed, and neither the product nor
  the test suite uses it. Every "not proven as behaviour" line in `STATE.md`
  is partly about that.
