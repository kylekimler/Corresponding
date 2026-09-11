import { readFile } from 'node:fs/promises';
import { expect, test } from './extension.fixture';

test('website edits, syncs, and offers contextual fill without opening the popup', async ({ context, extensionId }, testInfo) => {
  expect(extensionId).toBeTruthy();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://localhost:4173/');
  await page.screenshot({ path: testInfo.outputPath('home-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Create manuscript' }).click();
  await page.getByRole('textbox', { name: 'Manuscript title' }).fill('An atlas of collaboration');
  await page.getByLabel('Paste authors').fill('First name\tLast name\tEmail\tInstitution\nAda\tLovelace\tada@example.org\tUniversity of London\nAlan\tTuring\talan@example.org\tCambridge');
  await page.getByRole('button', { name: 'Import authors', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).first().fill('ada@');
  await expect(page.getByRole('heading', { name: 'Finish editing to sync' })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).first().fill('ada.updated@example.org');
  await expect(page.getByText('Saved to the Corresponding extension', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Email', { exact: true }).first()).toHaveValue('ada.updated@example.org');
  await expect(page.getByText('Saved to the Corresponding extension', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('workspace-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('workspace-mobile.png'), fullPage: true });

  const fixtureUrl = 'http://localhost:3000/fixtures/nature-mts-sample.html';
  await context.route(fixtureUrl, (route) => readFile('fixtures/nature-mts-sample.html', 'utf8').then((body) => route.fulfill({ contentType: 'text/html', body })));
  const journal = await context.newPage();
  await journal.goto(fixtureUrl);
  // This fixture deliberately starts with a nonempty first name. Clear it
  // as a user would; contextual fill must never overwrite it implicitly.
  await expect(journal.locator('#contrib_auth_1_first_nm')).toHaveValue('Existing');
  await journal.locator('#contrib_auth_1_first_nm').fill('');
  await expect(journal.getByRole('button', { name: 'Fill authors', exact: true })).toBeVisible();
  await journal.getByRole('button', { name: 'Fill authors', exact: true }).click();
  await expect(journal.locator('#contrib_auth_1_first_nm')).toHaveValue('Ada');
  await expect(journal.locator('#contrib_auth_1_email')).toHaveValue('ada.updated@example.org');
  expect(errors).toEqual([]);
});
