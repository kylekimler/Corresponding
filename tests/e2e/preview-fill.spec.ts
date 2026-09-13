import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';
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
  await expect(
    popup.getByText('Lifetime researcher hours saved: 0'),
  ).toBeVisible();
  return { fixture, popup };
}

test('production popup previews, fills, validates, and preserves protected controls', async ({
  context,
  extensionId,
}, testInfo) => {
  const { fixture, popup } = await openFixtureAndPopup(context, extensionId);
  await popup.setViewportSize({ width: 1280, height: 800 });
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
  await expect(fill).toBeEnabled();

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
  await popup.screenshot({ path: testInfo.outputPath('store-preview.png') });

  expect(
    await fixture
      .locator('input, select')
      .evaluateAll((elements) =>
        elements.map((element) => (element as HTMLInputElement).value),
      ),
  ).toEqual(valuesBeforePreview);

  const overwrite = popup.getByLabel('Overwrite non-empty fields');
  await overwrite.check();
  await expect(popup.getByText(/Preview ready — .*form unchanged/)).toHaveCount(0);
  await expect(fill).toBeEnabled();
  await overwrite.uncheck();
  await expect(fill).toBeEnabled();
  await keepFixtureActive(fixture, popup);
  await fill.click();

  await expect(popup.locator('.fill-delight')).toHaveText(
    /3 authors filled\. You just got 2 minutes of your life back\./,
  );
  await expect(
    popup.getByRole('heading', { name: 'After fill — validation' }),
  ).toBeVisible();
  await expect(popup.getByText('3 authors look filled')).toBeVisible();
  await expect(popup.getByText('0 conflicts')).toBeVisible();
  await popup.screenshot({ path: testInfo.outputPath('store-validation.png') });
  await expect(
    popup.getByText('Lifetime researcher hours saved: 0'),
  ).toBeVisible();

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

test('DOCX manuscript author table imports locally through the popup', async ({
  context,
  extensionId,
}) => {
  const { popup } = await openFixtureAndPopup(context, extensionId);
  const cell = (text: string) =>
    `<w:tc><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>Manuscript body is discarded</w:t></w:r></w:p>
        <w:tbl>
          <w:tr>${cell('First name')}${cell('Last name')}${cell('Email')}${cell('Affiliation 1')}</w:tr>
          <w:tr>${cell('Ada')}${cell('Lovelace')}${cell('ada@example.org')}${cell('Analytical Engines')}</w:tr>
          <w:tr>${cell('Alan')}${cell('Turing')}${cell('alan@example.org')}${cell('Bletchley Park')}</w:tr>
        </w:tbl>
      </w:body>
    </w:document>`;
  const docx = zipSync({
    'word/document.xml': strToU8(documentXml),
  });

  await popup.getByRole('button', { name: 'Import authors' }).click();
  await popup.locator('input[type="file"]').setInputFiles({
    name: 'manuscript.docx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: Buffer.from(docx),
  });

  await expect(popup.getByText('2 authors', { exact: true })).toBeVisible();
  await popup
    .getByRole('button', { name: 'Review imported authors →' })
    .click();
  await expect(
    popup.locator('.review-author-name').filter({ hasText: 'Ada Lovelace' }),
  ).toBeVisible();
  await expect(
    popup.locator('.review-author-name').filter({ hasText: 'Alan Turing' }),
  ).toBeVisible();
});

test('example authors stay reachable once a roster already exists', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/import.html`);
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.resolve('fixtures/sample-authors.csv'));
  await expect(page.getByText('3 authors', { exact: true })).toBeVisible();

  // With a roster selected the empty state is gone, so the sample has to be
  // reachable from the roster menu.
  await page.getByRole('button', { name: 'Roster menu' }).click();
  await page.getByRole('menuitem', { name: 'Add example authors' }).click();

  await expect(page.getByText('6 authors', { exact: true })).toBeVisible();
  await expect(page.getByText(/Example roster ready: 6 authors/)).toBeVisible();
});

test('the import page accepts a CSV file directly', async ({
  context,
  extensionId,
}) => {
  // A popup is destroyed by the native file dialog, so file selection lives on
  // this page instead.
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/import.html`);

  await expect(
    page.getByRole('heading', { name: 'Import authors' }),
  ).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.resolve('fixtures/sample-authors.csv'));

  await expect(page.getByText('3 authors', { exact: true })).toBeVisible();
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

  const fill = popup.getByRole('button', { name: 'Fill', exact: true });
  await expect(fill).toBeEnabled();
  await keepFixtureActive(fixture, popup, BIORXIV_FIXTURE_URL);
  await fill.click();

  await expect(popup.locator('.fill-delight')).toHaveText(
    /3 authors filled\. You just got 2 minutes of your life back\./,
  );
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
