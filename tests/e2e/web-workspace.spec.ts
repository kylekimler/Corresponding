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

test('Editorial Manager matches the observed country labels and retains review warnings after contextual fill', async ({ context, extensionId }, testInfo) => {
  expect(extensionId).toBeTruthy();
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await page.getByRole('button', { name: 'Create manuscript' }).click();
  await page.getByLabel('Paste authors').fill(
    'First name\tLast name\tEmail\tInstitution\tDepartment\tCity\tPostal Code\tCountry\tCRediT roles\n' +
    'Maya\tChen\tmaya@example.org\tExample Institute\tBiology\tCambridge\t02142\tUnited States\tConceptualization',
  );
  await page.getByRole('button', { name: 'Import authors', exact: true }).click();
  await expect(page.getByText('Saved to the Corresponding extension', { exact: true })).toBeVisible();

  const fixtureUrl = 'http://localhost:3000/fixtures/em-popup-validation.html';
  const html = await readFile('fixtures/em-popup-validation.html', 'utf8');
  // Live-observed labels, deliberately synthetic values; production selectors
  // and the existing fixture's delayed save/validation behavior are unchanged.
  const body = html.replace('<option value="United States">United States</option>',
    '<option value="test-us">UNITED STATES OF AMERICA</option>' +
    '<option value="test-islands">UNITED STATES MINOR OUTLYING ISLANDS</option>');
  await context.route(fixtureUrl, (route) => route.fulfill({ contentType: 'text/html', body }));
  const journal = await context.newPage();
  await journal.goto(fixtureUrl);
  await journal.getByRole('button', { name: 'Fill authors', exact: true }).click();
  await expect(journal.locator('#committed-authors')).toHaveText('Maya Chen');
  await expect(journal.locator('#CountryCode')).toHaveValue('test-us');
  const review = journal.locator('[data-corresponding-review]');
  await expect(review).toBeVisible();
  await review.locator('summary').click();
  await expect(review).toContainText('The journal reported validation issues.');
  await expect(journal.getByRole('button', { name: 'Fill authors', exact: true })).toHaveCount(0);
  await journal.screenshot({ path: testInfo.outputPath('editorial-manager-review.png'), fullPage: true });
  await journal.getByRole('button', { name: 'Dismiss Corresponding review notice' }).click();
  await expect(review).toHaveCount(0);
  await expect(journal.getByRole('button', { name: 'Fill authors', exact: true })).toHaveCount(0);
});
