# Reconcile git with what is actually running in production

## Job

Deploying the naming rename requires knowing exactly what production runs
today. Checked directly: `flyway_schema_history` on the live DB, and the
compiled classes inside the running jar, decompiled and diffed against
this repo. Production is running code — R9's account-wide sync
(AccountSyncService, AgentSyncLog, AgentEvalCase, AgentInsightsSnapshot,
migrations V66-V68) and several other fixes — that exists nowhere in git:
only as uncommitted files in this checkout. Deploying any branch as it
stood before this commit would have silently removed that live feature,
with no commit to recover it from afterward.

## Proof

Verified against the real server (`ubuntu@10.1.17.16`), not inferred:
- `flyway_schema_history`: versions up to 68 all `success=1`.
- `AccountSyncService`, `AgentSyncLog`, `AgentEvalCase`,
  `AgentInsightsSnapshot` and their repositories: `javap -p -c` on the
  class extracted from `/opt/metaagent/target/platform-0.1.0-SNAPSHOT.jar`
  is byte-for-byte identical to compiling this exact source locally.
- `GlobalSyncScheduler`, `WabaAgentReconciliationService`,
  `AgentDetailSyncService`, `AgentFaqRepository`, `AgentSkillRepository`,
  `Agent` entity: same result, byte-identical.
- `AgentService`: identical except for this session's own
  FileLibraryDtos -> KnowledgeBaseDtos rename (expected, committed
  separately).
- V66/V67/V68 migration SQL: extracted from the jar's resources, diffed
  text-identical against the local files.

## Notes

This is not new work being introduced — it is the missing historical
record of already-live production code, committed so git stops disagreeing
with reality. AccountSyncService.java lands as one commit over the usual
400-line cap because it is a single class already verified unchanged; splitting
it would produce an intermediate commit that does not compile, which is worse
than a longer diff.
