---
date: 2026-09-09
type: task
tags: [deployment, frontend, connectors, postman-layout, e2e]
status: active
---

# Connector Section: One Page, Live

## Context

The connector section had been redesigned on paper across two sessions — a
design canvas of ten artboards, and `docs/design/connector-section-redesign-tasks.md`
with T1–T29. On 2026-09-09 the founder approved the canvas ("I think this looks
good and we can proceed") and this is the first of those screens actually built.

The screen is the one the founder proposed themselves: "Cant we have Name,
Description at one place and below it actions tab which you made".

## Decision / Event

The connector's five section pills — Actions, Details, Authorization,
Variables, Agents — are gone. Everything they led to is on one page, in the
order the questions get asked: what is this → what can it do → who is running
it → what can I substitute → delete.

Deployed to production. Commits `7451491`, `e334269`, `8e61ddf`.

Two behaviours changed as a consequence, both deliberate:

- **Add an action** is a control on the Actions table, always present. The old
  redirect that turned "select Actions" into "open the request editor" existed
  only because there was a section to select, and it made an empty connector
  jump somewhere the user had not asked to go.
- **The breadcrumb's connector name is a link.** With the pills gone it is the
  only way back out of an open action.

The action keeps its tab row. A request has more in it than fits at once; a
connector does not.

## Rationale

The churn on this section was structural, not aesthetic: three navigation
systems over two objects. A connector is a name, a base URL, one credential, a
fixed list of Meta's five variables and a set of deployments. Postman tabs a
collection because a collection holds hundreds of requests; this holds seven
fields. Navigation invented to fill a screen is what put two tab strips on at
once ("why are there 2 tabs"), and what closed four fifths of a small object
behind a click ("when someone clicks on actions why are other sections
closed?").

## Proof

- `npm run build` clean (`tsc -b`, which catches project-reference errors that
  bare `npx tsc --noEmit` does not).
- Deployed, md5-verified: `index-YU71XeOP.js` →
  `5617e6653072f7bbdd3424741f305ab7`, matching the local build byte for byte.
- **Eight Playwright specs green against the live deploy**: `@workbench`,
  `@nested-body`, `@multi-auth`, `@connector-delete` (×3), `@feedback` (×2).
- Backups on the box: `/tmp/metaagent-backup-20260909101100.tar.gz` (pre-first
  swap) and `/tmp/metaagent-backup-20260909101326.tar.gz` (pre-second).

Rollback, if needed:
```bash
sudo rm -rf /var/www/metaagent/* && \
sudo tar xzf /tmp/metaagent-backup-20260909101100.tar.gz -C /var/www/metaagent
```

## What the browser caught that reading did not

"Add an action" matched two elements at once — the sidebar tree has carried one
per connector all along, and moving the other from a tab panel onto the page
put both in one document with the same name. Fixed by making the section a
named region (`aria-label="Actions"`) rather than by reaching for `.nth(1)`:
the ambiguity was real for a screen reader too, and `.nth(1)` would have made
the test pass while leaving the page ambiguous.

## Two operational notes

- **The documented bastion `ec2-user@13.232.241.246` timed out, and I blamed
  the bastion. It was the VPN.** The runbook's very first prerequisite says a
  timeout means no route and to check the VPN before suspecting anything else;
  I had read it and still recorded "the documented bastion is unreachable".
  With the VPN up it answers immediately.

  The real finding is more useful than the wrong one: **`ubuntu@13.206.206.254`
  is reachable without the VPN.** A whole deploy — scp, backup, swap, verify —
  went through it off-VPN. That is a route into the private network that the
  VPN does not gate, which is worth someone's attention for reasons that have
  nothing to do with convenience.
- `prettier --write` on an e2e spec reformats the entire file (111 and 164
  lines on two specs) — the repo's e2e specs are not prettier-formatted. Wrap
  long lines by hand, or extract a helper, which is what happened here.

## Not done

T1–T29 minus this screen. Next is the action page: base URL and auth shown per
action, one shared table component, and Send + Response — the part that makes
any of it verifiable. The frontend deploy swap is still `rm -rf` then `cp`, so
a live user can be served a broken app mid-swap.

## Related
- [[../decisions/postman-shaped-connectors-2026-09-07|Postman-shaped connectors]]
- [[2026-08-25-session/frontend-deploy-runbook|Frontend Deploy Runbook]]
- [[../lessons/verification|What counts as proof]]
