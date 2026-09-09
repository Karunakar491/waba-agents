import { expect } from '@playwright/test'
import { test } from './fixtures/auth'
import { addAction, createThrowawayConnector, deleteOpenConnector } from './fixtures/connectors'

/**
 * Proves the cURL box fills the request, and says what it cannot represent.
 *
 * The command below is the shape of the one the founder pasted — the IndiaMART
 * WhatsApp product search: a query parameter in the URL, a JSON body, a bearer
 * credential and `--location`. Its token is a placeholder; the real one was
 * live and is being rotated, and a credential does not belong in a repository.
 *
 * Writes, scoped like the other write specs: a connector in our own library,
 * obviously named, never published — so it reaches no Meta object, no agent and
 * no phone number. It deletes what it created. Nothing here presses Send, so no
 * third-party API is called by this spec.
 *
 * Tagged @curl-import, out of every default suite.
 */
const CONNECTOR = 'zz-curl-import-check (safe to delete)'

const CURL = `curl --location 'https://example.invalid/whatsapp/mba/index.php?action=product-search' \\
--header 'Authorization: Bearer TOKEN-PLACEHOLDER' \\
--header 'Content-Type: application/json' \\
--header 'X-Trace: abc123' \\
--data '{"action":"product-search","query":"biryani","city":"Delhi"}'`

test.describe('@curl-import pasting a cURL fills the action', () => {
  test('it reads the request, warns about redirects, and applies the fields', async ({
    authedPage: page,
  }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 1440, height: 900 })

    // createThrowawayConnector uses https://example.invalid, which is the same
    // host as the cURL above — so this asserts the import path, not the
    // different-host warning. That warning gets its own check below.
    await createThrowawayConnector(page, CONNECTOR)
    await addAction(page)

    const importer = page.getByRole('button', { name: /Import a cURL command/i })
    await expect(importer).toBeVisible()
    await importer.click()

    const box = page.getByRole('region', { name: 'Import a cURL command' })
    await box.getByRole('textbox').fill(CURL)
    await box.getByRole('button', { name: /^Check it$/ }).click()

    // What it read, before anything is applied. Scoped to the summary list:
    // the textarea still holds the pasted command, so it contains every one of
    // these strings too, and an unscoped match hits both.
    const read = box.locator('dl')
    await expect(read.getByText('POST', { exact: true })).toBeVisible()
    await expect(read.getByText('/whatsapp/mba/index.php', { exact: true })).toBeVisible()
    await expect(read.getByText('action=product-search', { exact: true })).toBeVisible()

    // The credential is named, never shown — the value came off a clipboard.
    await expect(read.getByText(/Authorization — set on the connector/)).toBeVisible()
    await expect(read.getByText(/TOKEN-PLACEHOLDER/)).toHaveCount(0)

    // --location is reported, because we follow no redirects.
    await expect(box.getByText(/follows redirects/i)).toBeVisible()
    // And so the confirm button admits there is something to read first.
    await box.getByRole('button', { name: /^Import anyway$/ }).click()

    // ---- the request is now filled in --------------------------------------
    await expect(page.locator('#wb-method')).toHaveValue('POST')
    await expect(page.locator('#wb-path')).toHaveValue('/whatsapp/mba/index.php')

    // The query parameter became a row with the value it was pasted with.
    await expect(page.locator('#query-parameters-0-key')).toHaveValue('action')
    await expect(page.locator('#query-parameters-0-fixedvalue')).toHaveValue('product-search')

    // X-Trace became a header row; Content-Type did not, because Meta sets it.
    await page.getByRole('tab', { name: /^Headers/ }).click()
    await expect(page.locator('#headers-0-key')).toHaveValue('X-Trace')
    // Exactly one row, and it is not Content-Type: Meta sets that itself, and
    // AutoHeaders already shows it, so importing it would offer a row whose
    // value has no effect.
    await expect(page.locator('input[id^="headers-"][id$="-key"]')).toHaveCount(1)

    // The JSON body became described fields rather than a blob of text.
    await page.getByRole('tab', { name: /^Body/ }).click()
    await expect(page.getByText('query', { exact: true })).toBeVisible()
    await expect(page.getByText('city', { exact: true })).toBeVisible()

    await page.screenshot({ path: 'e2e-shots/curl-import.png' })

    // ---- clean up ----------------------------------------------------------
    await deleteOpenConnector(page)
  })
})
