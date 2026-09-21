# Take a library skill off one agent, not all of them

## Job

An operator opens an agent that has a shared Skill attached, and decides this
particular agent should stop using it; they detach it there and the other agents
keep it. Before this, the only lever was deleting the skill from the Library,
which pulled it off every agent at once — so the answer to "just this one" was
"you can't".

## Proof

`SkillLibraryServiceDetachTest` (142 lines, committed alongside) covers the
service: the Meta `DELETE` is scoped to that agent's phone number and agent id,
the library row survives, and an agent with no phone number gets a refusal that
says why rather than a 500.

Not yet proven, and stated plainly because there is no UI: no operator has ever
done this on a screen, and no e2e drives it. That is what remains before it can
be called done.

## Notes

Meta has no detach. Skills belong to one agent there and the only primitive is
`DELETE /{skill_id}` (`docs/meta-api/skills.md`). The shared Library — one
definition attached to many agents — is ours, so "remove it from this agent
only" is a concept Meta's model has no word for.

Found uncommitted in the working tree on 2026-09-21. Founder confirmed the same
day that it is wanted, so it is committed to `feature/skill-detach` rather than
left as loose files a stray command can destroy — which had already happened to
two other files that day.

The backend is complete. The UI is not started.
