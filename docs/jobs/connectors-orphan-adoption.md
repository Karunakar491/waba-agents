# Connectors — orphan adoption (R4/R6 slice 4, part 1)

## Job

A business owner (or whoever set up their number before we existed) has a
connector running on Meta that our library never recorded — today it is
invisible everywhere: not in the Connectors section, not on the agent, not
editable, not deletable. After this, the hourly backfill sweep creates the
missing library row and deployment from what Meta reports, so it appears in
the same list as everything else and its actions are read back too. Part of
`docs/user-stories/R4-R6-same-screen-everywhere.md` slice 4, test case 11.

## Proof

Unit-tested only so far — `ConnectorBackfillSweepTest`:
`should_adopt_a_connector_meta_reports_that_we_never_recorded` and
`should_not_adopt_a_connector_whose_auth_type_we_cannot_store`, both green
(`mvn -o test -Dtest=ConnectorBackfillSweepTest`, exit 0), alongside the
existing six sweep tests, unchanged and still green.

**Not yet proven against real Meta — this is server-side only and the sweep
does not run against a local backend.** Verifying it for real needs a
production deploy plus a connector created directly on Meta for the reserved
test agent (bypassing our own deploy endpoint) to prove the sweep picks it up.
Held for a deploy decision — see the reply that references this job.

## Notes

- Deliberately one Connector+ConnectorDeployment row per (agent, Meta
  connector id), never merged by name across agents — Meta scopes a
  connector's id to a phone number, so the same integration built by hand on
  three numbers really is three distinct objects. Merging on name would
  repeat the exact "hides an unrelated connector on a collision" defect the
  spec calls out in the old read-only view.
- `requiresCertificate` defaults to `false` on an adopted row since Meta's
  list response doesn't say; a later redeploy will surface it if that guess
  is wrong. Known limitation, not silently swallowed — noted in the class.
- Auth types outside `API_KEY` / `OAUTH2_CLIENT_CREDENTIALS` / `NONE` are
  skipped, not stored — matches Meta's own "defined but not currently
  supported" note in `docs/meta-api/connectors.md` for BASIC/CUSTOM/OAUTH2.
