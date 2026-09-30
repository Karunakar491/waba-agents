# Stop calling Skills, Business Events and Knowledge Base a "Library"

## Job

Following on from the Connectors naming fix: the founder pointed out the
same mistake exists everywhere else that lets a user create and edit
something — a library is somewhere you browse and refer to, not somewhere
you make and delete things. Skills' own Browse Templates is the one real
library in the product; everywhere else, "Library" in a class name, route,
or on-screen label is renamed to say what the screen actually is.

Whoever reads this code next — or the founder looking at a screen — sees
one name for one concept, not "Library" in the code and something else on
screen.

## What changed

- Skills: `SkillLibraryController/Service` → `SkillController/Service`. Wire
  value `source: "LIBRARY"` → `"SHARED"` end to end (backend + every
  frontend consumer), `librarySkillId` → `sharedSkillId`.
- Business Events: `BusinessEventLibraryController/Service/Dtos` →
  `BusinessEventController/Service/Dtos`; the pre-existing fire-history
  classes (which were plainly named while the CRUD layer held the "Library"
  suffix) renamed to `BusinessEventFireController/Dtos` to make room.
- Knowledge Base: `FileLibraryController/Dtos` → `KnowledgeBaseController/
  Dtos`.
- Pages renamed to match: `SkillLibraryPage` → `SkillsPage`,
  `BusinessEventsLibraryPage` → `BusinessEventsPage`, `FileLibraryPage` →
  `KnowledgeBasePage`, `SkillsLibraryDrawer` → `YourSkillsDrawer`,
  `UiSkillsLibraryTable` → `UiSkillsTable`. Shared `components/library/
  LibraryTable(.tsx)/LibraryToolbar(.tsx)` (used by all three screens plus
  Business Persona) → `components/records/RecordsTable/RecordsToolbar`.
- Query keys `library-skills`/`library-ui-skills`/`library-files`/
  `library-websites`/`library-faqs` renamed to match (`shared-skills`,
  `ui-skills-rollup`, `kb-files`, `kb-websites`, `kb-faqs`) — caught and
  fixed one real bug this introduced: a stale invalidation key in
  `SkillTemplateBrowsePage.tsx` that would have silently stopped refreshing
  the Skills list after copying a template.

No DB tables, columns or migration files renamed — Flyway checksums an
applied migration by its filename, so renaming one is a production
incident waiting to happen, not a readability win. `published_to_library`-
style columns keep their names; only the Java/TS code reading them changed
(see the connectors job for the same call).

Left alone: the `/library/*` URL paths (founder's own prior call — renaming
eight routes and ~40 e2e specs for a word only engineers see in the address
bar), and `SkillTemplateBrowsePage`'s "Browse Templates" naming, which is
the one genuine library in the product.

## Proof

- Backend: `./mvnw -o compile` and `./mvnw -o test-compile` exit 0.
  `SkillServiceDetachTest`, `AgentServiceConvertToDraftTest`,
  `BusinessEventQueryServiceTest` pass.
- Frontend: `npx tsc --noEmit -p .` exits 0 across the whole rename.
- **Not proven**: no real-app / e2e pass — same gap as the connectors job,
  not closed here either.

## Note on scope

This checkout had a large pre-existing uncommitted diff on this branch
before this rename started (R8/R9 feature work in progress — repository
methods, draft-resume, connector deploy changes). That work is untouched
and NOT part of these commits. A few files this rename also touches
(`AgentService.java`, the connector domain's service, `StepSkills.tsx`,
`StepConnectors.tsx`, `CreateAgentPage.tsx`) already carried unrelated
pre-existing edits before this session started; where a file's pre-existing
diff was small, this commit set carries it along rather than leaving the
tree in a half-renamed state. Where it was large (the connector domain
service — 300+ pre-existing lines), that file is excluded from these
commits entirely; the one or two comment words this rename would have
touched there are left uncommitted.
