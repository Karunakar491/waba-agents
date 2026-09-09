import { expect, type Page } from '@playwright/test'

/**
 * Creating and removing a throwaway connector, in one place.
 *
 * Five specs needed this and each carried its own copy, which meant that when
 * the Connectors screen became the workbench — no list page, no table rows, no
 * per-row Edit link — all five broke in the same way at once. One helper is one
 * thing to fix next time.
 *
 * Every connector these make is named so a human seeing it on the account knows
 * it is disposable, and none is ever published, so no Meta object, agent or
 * phone number is touched.
 */

/**
 * Back to the connector's own page from an open action.
 *
 * There used to be a five-pill section nav in the header and a
 * `connectorSection()` helper to address it. The connector is one page now, so
 * everything those pills led to is already on screen — the only navigation
 * left is leaving an action, which is the breadcrumb's connector name.
 */
export async function openConnectorPage(page: Page): Promise<void> {
  if (!/\/actions\//.test(page.url())) return
  // The breadcrumb's connector name is the only link to a numbered connector
  // outside the tree, and the tree's entries are buttons.
  await page.locator('a[href^="/library/connectors/"]').first().click()
  await expect(page).toHaveURL(/\/library\/connectors\/\d+$/)
}

/**
 * Opens an empty request editor.
 *
 * From the SIDEBAR's per-connector "Add an action", not the main pane's — the
 * pane's button is gone. On the connector screen the Actions table's trailing
 * row IS the add, and it creates the action outright rather than opening an
 * editor, so it cannot serve a test that wants to fill a request in.
 *
 * Scoped to the tree, because the two were indistinguishable by name.
 */
export async function addAction(page: Page): Promise<void> {
  await page.locator('div.w-72').getByRole('button', { name: /Add an action/i }).click()
  await expect(page).toHaveURL(/[/]actions[/]new$/)
}

/**
 * Adds an action from the Actions table's trailing row — the screen's own add.
 *
 * Leaves the browser on the connector, because that is what the row does: no
 * navigation, the row typed in becomes the row above it.
 */
export async function addActionInRow(
  page: Page,
  action: { name: string; path: string; description: string },
): Promise<void> {
  const table = page.getByRole('region', { name: 'Actions' })
  await table.getByLabel('Name for the new action').fill(action.name)
  await table.getByLabel('Path for the new action').fill(action.path)
  await table.getByLabel('Description for the new action').fill(action.description)
  await table.getByRole('button', { name: /^Add$/ }).click()
  await expect(page.getByRole('status')).toContainText(/Action added/i, { timeout: 20_000 })
}

/** Removes a leftover from an interrupted run, if one is there. */
export async function removeConnectorIfPresent(page: Page, name: string): Promise<void> {
  await page.goto('/library/connectors')
  await page.waitForLoadState('networkidle')

  const inTree = page.locator('div.w-72 button', { hasText: name })
  if ((await inTree.count()) === 0) return

  await inTree.first().click()
  await expect(page).toHaveURL(/\/library\/connectors\/\d+$/)
  await deleteOpenConnector(page)
}

/**
 * Creates one and leaves the browser on its page.
 *
 * Fills the property table on the New connector screen, which is the same
 * table the saved connector shows: click a row's value, type, move on. Auth is
 * not set here — it lives on an action's Authorization tab now — so a
 * connector this makes has no credential until a spec adds one.
 */
export async function createThrowawayConnector(
  page: Page,
  name: string,
  description = 'Created by an automated check. Safe to delete.',
): Promise<void> {
  await removeConnectorIfPresent(page, name)

  // The sidebar's +. The main pane's empty state offers the same thing, which
  // is fine for a user and ambiguous for a test, so this says which.
  await page.locator('div.w-72').getByRole('button', { name: 'New connector' }).click()
  await expect(page).toHaveURL(/[/]library[/]connectors[/]new$/)

  await setProperty(page, 'Name', name)
  await setProperty(page, 'Description', description)
  await setProperty(page, 'Base URL', 'https://example.invalid')

  await page.getByRole('button', { name: /^Create connector$/ }).click()
  await expect(page.getByRole('status')).toContainText(/Connector saved/i, { timeout: 20_000 })
  // Saving navigates to the connector's own page, so callers can act on it.
  await expect(page).toHaveURL(/\/library\/connectors\/\d+$/, { timeout: 20_000 })
}

/**
 * Sets one row of a property table.
 *
 * The row is a value until it is clicked and an input after, which is the
 * point of the pattern — so a test has to click it before it can type, exactly
 * as a person does.
 */
export async function chooseProperty(page: Page, label: string, value: string): Promise<void> {
  await openProperty(page, label)
  await page.getByLabel(label, { exact: true }).selectOption(value)
}

/** Turns one row from a value into its input. */
async function openProperty(page: Page, label: string): Promise<void> {
  await page.getByRole('rowheader', { name: label }).locator('..').getByRole('button').click()
}

export async function setProperty(page: Page, label: string, value: string): Promise<void> {
  await openProperty(page, label)
  await page.getByLabel(label, { exact: true }).fill(value)
  await page.getByLabel(label, { exact: true }).blur()
}

/**
 * Deletes the connector currently open, asserting it is gone.
 *
 * The pane's button and the dialog's confirm are both called "Delete
 * connector", so each is addressed by where it is rather than by name alone.
 */
export async function deleteOpenConnector(page: Page): Promise<void> {
  // Delete is at the foot of the connector's page — it is the connector itself,
  // not one of its requests.
  await openConnectorPage(page)
  await page.getByRole('button', { name: /^Delete connector$/ }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /^Delete connector$/ }).click()
  await expect(page.getByRole('status')).toContainText(/Connector deleted/i, { timeout: 20_000 })
  await expect(page).toHaveURL(/\/library\/connectors$/, { timeout: 20_000 })
}
