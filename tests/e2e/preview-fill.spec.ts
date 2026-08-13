import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './extension.fixture';

const FIXTURE_URL =
  'http://localhost:3000/fixtures/nature-mts-sample.html';
const BIORXIV_FIXTURE_URL =
  'http://localhost:3000/fixtures/biorxiv-author-modal-sample.html';
const PROTECTED_CONTROL_IDS = [
  'save_authors',
  'final_submit',
  'certify_accuracy',
  'accept_copyright',
  'pay_apc',
];

async function keepFixtureActive(
  fixture: Page,
  popup: Page,
  expectedUrl = FIXTURE_URL,
): Promise<void> {
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
    .toBe(expectedUrl);
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
    '',
    'First name',
    'Last Name',
    'Name on paper',
    'ORCID',
    'Affiliation 1',
    'Affiliation 2',
    'Affiliation 3',
    'Support/ Funding Statement',
    'Conflicts of Interest',
  ];
  const row = [
    '*',
    'Ada',
    'Lovelace',
    'Ada Lovelace',
    '0000-0002-1825-0097',
    'Analytical Engines Institute',
    '',
    '',
    'Supported by Grant A',
    'No competing interests',
  ];

  await popup.getByRole('button', { name: 'Import authors' }).click();
  await popup
    .getByRole('button', { name: /Paste Google Sheet or Excel table/ })
    .click();
  await popup
    .getByLabel('Paste spreadsheet table')
    .fill(`${headers.join('\t')}\n${row.join('\t')}`);
  await popup.getByRole('button', { name: 'Continue' }).click();

  const mappings = popup.getByLabel('Column mapping');
  await expect(mappings).toHaveCount(headers.length);
  await expect(mappings.nth(0)).toHaveValue('ignore');
  await expect(mappings.nth(1)).toHaveValue('givenName');
  await expect(mappings.nth(2)).toHaveValue('familyName');
  await expect(mappings.nth(3)).toHaveValue('ignore');
  await expect(mappings.nth(4)).toHaveValue('orcid');
  await expect(mappings.nth(5)).toHaveValue('institution');
  await expect(mappings.nth(8)).toHaveValue('fundingStatement');
  await expect(mappings.nth(9)).toHaveValue('disclosureStatement');
  for (const index of [6, 7]) {
    await expect(mappings.nth(index)).toHaveValue('ignore');
  }

  await mappings.nth(7).selectOption('city');
  await mappings.nth(7).selectOption('ignore');
  await popup.getByRole('button', { name: 'Import', exact: true }).click();

  await expect(popup.getByText('1 authors', { exact: true })).toBeVisible();
  await expect(popup.getByText(/Map at least First\/Given name/)).toHaveCount(0);
  await popup
    .getByRole('button', { name: 'Review imported authors →' })
    .click();
  await expect(
    popup.getByRole('heading', { name: 'Review imported authors' }),
  ).toBeVisible();
  await expect(
    popup.locator('.review-author-name').filter({ hasText: 'Ada Lovelace' }),
  ).toBeVisible();
  await popup.getByText('Project statements').click();
  await expect(popup.getByText('Supported by Grant A')).toBeVisible();
  await expect(popup.getByText('No competing interests')).toBeVisible();
  await expect(popup.getByRole('button', { name: /Duplicate|Export|Edit/ })).toHaveCount(
    0,
  );
});

test('bioRxiv modal workflow saves each author and never continues the page', async ({
  context,
  extensionId,
}) => {
  const fixtureHtml = await readFile(
    path.resolve('fixtures/biorxiv-author-modal-sample.html'),
    'utf8',
  );
  await context.route(BIORXIV_FIXTURE_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: fixtureHtml,
    }),
  );
  const fixture = await context.newPage();
  await fixture.goto(BIORXIV_FIXTURE_URL);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await keepFixtureActive(fixture, popup, BIORXIV_FIXTURE_URL);
  await popup.reload();
  await expect(
    popup.getByText('bioRxiv / medRxiv', { exact: true }),
  ).toBeVisible();

  await popup.getByRole('button', { name: 'Import authors' }).click();
  await popup
    .locator('input[type="file"]')
    .setInputFiles(path.resolve('fixtures/sample-authors.csv'));
  await expect(popup.getByText('3 authors', { exact: true })).toBeVisible();

  const preview = popup.getByRole('button', { name: 'Preview', exact: true });
  const fill = popup.getByRole('button', { name: 'Fill', exact: true });
  await expect(fill).toBeDisabled();
  await keepFixtureActive(fixture, popup, BIORXIV_FIXTURE_URL);
  await preview.click();
  await expect(popup.getByText(/Preview ready — .*form unchanged/).first()).toBeVisible();
  await expect(fill).toBeEnabled();
  await keepFixtureActive(fixture, popup, BIORXIV_FIXTURE_URL);
  await fill.click();

  await expect(
    popup.getByText(/Fill complete\. Validation finished/),
  ).toBeVisible();
  await expect(popup.getByText('3 authors look filled')).toBeVisible();
  const state = await fixture.evaluate(() => {
    return (
      window as typeof window & {
        __biorxivFixture: {
          saved: Array<{
            firstName: string;
            lastName: string;
            corresponding: boolean;
          }>;
          continueClicks: number;
          addClicks: number;
          saveClicks: number;
        };
      }
    ).__biorxivFixture;
  });
  expect(state.saved).toHaveLength(3);
  expect(state.saved[0]).toEqual(
    expect.objectContaining({ firstName: 'Ada', lastName: 'Lovelace' }),
  );
  expect(state.saved.filter((author) => author.corresponding)).toHaveLength(1);
  expect(state.addClicks).toBe(3);
  expect(state.saveClicks).toBe(3);
  expect(state.continueClicks).toBe(0);
});
