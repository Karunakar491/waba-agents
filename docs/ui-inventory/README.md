# UI inventory

**Generated — do not edit.** Run `node scripts/ui-inventory.js`.

Coverage is matched on accessible name, because that is what the e2e suite
selects by (this repo has no `data-testid` and must keep it that way). A control
with no accessible name is listed as a defect: it cannot be tested by name, and a
screen reader cannot announce it.

To find a control, grep this directory for its on-screen label.

- **27** routes
- **230** named controls, **5** driven by a test (**2%**)
- **82** controls with no accessible name

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
| [components-agent-detail](components-agent-detail.md) | 36 | 0 | 5 |
| [components-connectors](components-connectors.md) | 22 | 2 | 13 |
| [components-create-agent](components-create-agent.md) | 16 | 0 | 10 |
| [components-debug](components-debug.md) | 6 | 0 | 1 |
| [components-files](components-files.md) | 2 | 0 | 1 |
| [components-layout](components-layout.md) | 7 | 0 | 6 |
| [components-router](components-router.md) | 3 | 0 | 0 |
| [components-shared](components-shared.md) | 6 | 0 | 6 |
| [components-skills](components-skills.md) | 1 | 0 | 0 |
| [components-templatestudio](components-templatestudio.md) | 49 | 1 | 9 |
| [components-waba](components-waba.md) | 4 | 0 | 3 |
| [pages](pages.md) | 78 | 2 | 28 |
