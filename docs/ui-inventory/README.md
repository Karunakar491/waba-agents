# UI inventory

**Generated — do not edit.** Run `node scripts/ui-inventory.js`.

Coverage is matched on accessible name, because that is what the e2e suite
selects by (this repo has no `data-testid` and must keep it that way). A control
with no accessible name is listed as a defect: it cannot be tested by name, and a
screen reader cannot announce it.

**Read coverage as an upper bound.** Names are matched as strings and as the
regexes Playwright specs actually use, so two different buttons that read
"Continue" on two different screens both count as driven by any spec clicking
either. It answers "has anything ever pressed a control by this name?", not
"is this journey tested?". Only the uncovered column is exact.

To find a control, grep this directory for its on-screen label.

## Business Agents

- **27** routes
- **181** named controls, **61** driven by a test (**34%**)
- **73** controls with no accessible name

> Template Studio is **out of scope** (founder, 2026-09-21) and its 49 controls are excluded from these numbers. Its area file is still generated, because a control nobody watches is how a regression ships.

## Routes

| Path | Screen |
|---|---|
| `/login` | LoginPage |
| `/` | RootRedirect |
| `/select` | ModuleSelectorPage |
| `/dashboard` | DashboardPage |
| `/templates` | TemplateStudioPage |
| `/templates/iris` | TemplateIrisPage |
| `/templates/iris/all` | TemplateIrisAllChatsPage |
| `/templates/settings` | TemplateSettingsPage |
| `/templates/debug` | TemplateDebugPage |
| `/agents` | AgentsPage |
| `/agents/new` | CreateAgentPage |
| `/agents/:id` | AgentDetailPage |
| `/library/skills` | SkillLibraryPage |
| `/library/skills/:skillId/edit` | SkillEditPage |
| `/library/persona` | BusinessPersonaLibraryPage |
| `/library/connectors` | ConnectorWorkbenchPage |
| `/library/connectors/:connectorId` | ConnectorWorkbenchPage |
| `/library/connectors/:connectorId/actions/:actionId` | ConnectorWorkbenchPage |
| `/library/files` | FileLibraryPage |
| `/reports` | ReportsPage |
| `/debug` | DebugPage |
| `/wabas` | WabasPage |
| `/wabas/:wabaId` | WabaDetailPage |
| `/inbox` | InboxPage |
| `/handover` | HumanHandoverPage |
| `/profile` | ProfilePage |
| `*` | NotFoundPage |

## By area

| Area | Controls | Covered | Unnamed |
|---|---|---|---|
| [components-agent-detail](components-agent-detail.md) | 36 | 12 | 5 |
| [components-connectors](components-connectors.md) | 22 | 14 | 13 |
| [components-create-agent](components-create-agent.md) | 16 | 4 | 10 |
| [components-debug](components-debug.md) | 6 | 1 | 1 |
| [components-files](components-files.md) | 2 | 0 | 1 |
| [components-layout](components-layout.md) | 7 | 0 | 6 |
| [components-router](components-router.md) | 3 | 0 | 0 |
| [components-shared](components-shared.md) | 6 | 2 | 6 |
| [components-skills](components-skills.md) | 1 | 1 | 0 |
| [components-templatestudio](components-templatestudio.md) _(out of scope)_ | 49 | 10 | 9 |
| [components-waba](components-waba.md) | 4 | 2 | 3 |
| [pages](pages.md) | 78 | 25 | 28 |
