import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';
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

test('production popup previews, fills, validates, and preserves protected controls', async ({
  context,
  extensionId,
}) => {
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

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await keepFixtureActive(fixture, popup);
  await popup.reload();

  await expect(
    popup.getByText('Nature MTS / eJournalPress', { exact: true }),
  ).toBeVisible();

  await popup.getByRole('button', { name: 'Import authors' }).click();
  await popup.getByRole('button', { name: 'Upload CSV' }).click();
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
    popup.getByText(/Fill complete\. Validation found issues/),
  ).toBeVisible();
  await expect(
    popup.getByRole('heading', { name: 'After fill — validation' }),
  ).toBeVisible();
  await expect(popup.getByText('2 authors look filled')).toBeVisible();
  await expect(popup.getByText('1 conflicts')).toBeVisible();

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
  await expect(fixture.locator('#contrib_auth_2_first_nm')).toHaveValue('');
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
