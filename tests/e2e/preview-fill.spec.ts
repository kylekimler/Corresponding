import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './extension.fixture';

const FIXTURE_URL =
  'http://localhost:3000/fixtures/nature-mts-sample.html';
const PROTECTED_CONTROL_IDS = [
  'save_authors',
  'final_submit',
  'certify_accuracy',
  'accept_copyright',
  'pay_apc',
];

async function keepFixtureActive(fixture: Page, popup: Page): Promise<void> {
  await fixture.bringToFront();
  await expect
    .poll(() =>
      popup.evaluate(async () => {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        return tab?.url;
      }),
    )
    .toBe(FIXTURE_URL);
}

async function openFixtureAndPopup(
  context: BrowserContext,
  extensionId: string,
): Promise<{ fixture: Page; popup: Page }> {
  const fixtureHtml = await readFile(
    path.resolve('fixtures/nature-mts-sample.html'),
    'utf8',
  );
  await context.route(FIXTURE_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: fixtureHtml,
    }),
  );

  const fixture = await context.newPage();
  await fixture.goto(FIXTURE_URL);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await keepFixtureActive(fixture, popup);
  await popup.reload();
  await expect(
    popup.getByText('Nature MTS / eJournalPress', { exact: true }),
  ).toBeVisible();
  return { fixture, popup };
}

test('production popup previews, fills, validates, and preserves protected controls', async ({
  context,
  extensionId,
}) => {
  const { fixture, popup } = await openFixtureAndPopup(context, extensionId);
  await fixture.evaluate((controlIds) => {
    const trackedWindow = window as typeof window & {
      correspondingProtectedClicks: string[];
    };
    trackedWindow.correspondingProtectedClicks = [];
    for (const id of controlIds) {
      document.getElementById(id)?.addEventListener('click', () => {
        trackedWindow.correspondingProtectedClicks.push(id);
      });
    }
    document.getElementById('author_form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      trackedWindow.correspondingProtectedClicks.push('form-submit');
    });
  }, PROTECTED_CONTROL_IDS);

  await popup.getByRole('button', { name: 'Import authors' }).click();
  await expect(popup.getByText('Upload CSV', { exact: true })).toBeVisible();
  await popup
    .locator('input[type="file"]')
    .setInputFiles(path.resolve('fixtures/sample-authors.csv'));
  await expect(popup.getByText('3 authors', { exact: true })).toBeVisible();

  const preview = popup.getByRole('button', { name: 'Preview', exact: true });
  const fill = popup.getByRole('button', { name: 'Fill', exact: true });
  await expect(fill).toBeDisabled();

  const valuesBeforePreview = await fixture
    .locator('input, select')
    .evaluateAll((elements) =>
      elements.map((element) => (element as HTMLInputElement).value),
    );
  await keepFixtureActive(fixture, popup);
  await preview.click();
  await expect(popup.getByText(/Preview ready — .*form unchanged/).first()).toBeVisible();
  await expect(fill).toBeEnabled();
  await expect(
    popup.getByText(/selector confidence and completeness/i),
  ).toBeVisible();
  await expect(popup.getByText('Needs attention').first()).toBeVisible();

  expect(
    await fixture
      .locator('input, select')
      .evaluateAll((elements) =>
        elements.map((element) => (element as HTMLInputElement).value),
      ),
  ).toEqual(valuesBeforePreview);

  const overwrite = popup.getByLabel('Overwrite non-empty fields');
  await overwrite.check();
  await expect(fill).toBeDisabled();
  await overwrite.uncheck();
  await expect(fill).toBeDisabled();

  await keepFixtureActive(fixture, popup);
  await preview.click();
  await expect(fill).toBeEnabled();
  await keepFixtureActive(fixture, popup);
  await fill.click();

  await expect(
    popup.getByText(/Fill complete\. Validation finished/),
  ).toBeVisible();
  await expect(
    popup.getByRole('heading', { name: 'After fill — validation' }),
  ).toBeVisible();
  await expect(popup.getByText('3 authors look filled')).toBeVisible();
  await expect(popup.getByText('0 conflicts')).toBeVisible();

  await expect(fixture.locator('#corr_auth_first_nm')).toHaveValue('Ada');
  await expect(fixture.locator('#corr_auth_email')).toHaveValue(
    'ada@example.org',
  );
  await expect(fixture.locator('#contrib_auth_1_first_nm')).toHaveValue(
    'Existing',
  );
  await expect(fixture.locator('#contrib_auth_1_email')).toHaveValue(
    'ada@example.org',
  );
  await expect(fixture.locator('#contrib_auth_2_first_nm')).toHaveValue('Alan');
  await expect(fixture.locator('#contrib_auth_2_email')).toHaveValue(
    'alan@example.org',
  );
  await expect(fixture.locator('#contrib_auth_3_first_nm')).toHaveValue('田中');
  await expect(fixture.locator('#contrib_auth_3_last_nm')).toHaveValue('Müller');
  await expect(fixture.locator('#certify_accuracy')).not.toBeChecked();
  await expect
    .poll(() =>
      fixture.evaluate(() => {
        const trackedWindow = window as typeof window & {
          correspondingProtectedClicks: string[];
        };
        return trackedWindow.correspondingProtectedClicks;
      }),
    )
    .toEqual([]);
});

test('wide Excel-style paste defaults extra columns to Ignore and imports', async ({
  context,
  extensionId,
}) => {
  const { popup } = await openFixtureAndPopup(context, extensionId);
  const headers = [
    'Order',
    'Author type',
    'Given name',
    'Family name',
    'Name on paper',
    'ORCID',
    'Email (portal)',
    'Affiliation numbers',
    'Affiliation 1',
    'Affiliation 2',
    'Affiliation 3',
    'Affiliation 4',
    'Affiliation 5',
    'Equal contribution',
    'Joint supervision',
    'Portal status',
    'Notes',
  ];
  const row = [
    '1',
    'Researcher',
    'Ada',
    'Lovelace',
    'Ada Lovelace',
    '0000-0002-1825-0097',
    'ada@example.org',
    '1',
    'Analytical Engines Institute',
    '',
    '',
    '',
    '',
    '',
    '',
    'Ready',
    'Imported from workbook',
  ];

  await popup.getByRole('button', { name: 'Import authors' }).click();
  await popup
    .getByRole('button', { name: /Paste from spreadsheet/ })
    .click();
  await popup
    .getByLabel('Paste spreadsheet table')
    .fill(`${headers.join('\t')}\n${row.join('\t')}`);
  await popup.getByRole('button', { name: 'Continue' }).click();

  const mappings = popup.getByLabel('Column mapping');
  await expect(mappings).toHaveCount(headers.length);
  await expect(mappings.nth(2)).toHaveValue('givenName');
  await expect(mappings.nth(3)).toHaveValue('familyName');
  await expect(mappings.nth(8)).toHaveValue('institution');
  for (const index of [1, 4, 7, 9, 10, 11, 12, 13, 14, 15, 16]) {
    await expect(mappings.nth(index)).toHaveValue('ignore');
  }

  await mappings.nth(16).selectOption('city');
  await mappings.nth(16).selectOption('ignore');
  await popup.getByRole('button', { name: 'Import', exact: true }).click();

  await expect(popup.getByText('1 authors', { exact: true })).toBeVisible();
  await expect(popup.getByText(/Map at least First\/Given name/)).toHaveCount(0);
  await popup
    .getByRole('button', { name: 'Review imported authors →' })
    .click();
  await expect(
    popup.getByRole('heading', { name: 'Review imported authors' }),
  ).toBeVisible();
  await expect(popup.getByText(/Ada Lovelace/)).toBeVisible();
  await expect(popup.getByRole('button', { name: /Duplicate|Export|Edit/ })).toHaveCount(
    0,
  );
});
