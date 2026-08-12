import { describe, expect, it } from 'vitest';
import { buildNatureMtsFixtureHtml } from '@/adapters/nature-mts/fixture';
import {
  captureForm,
  previewCapture,
} from '@/diagnostics/capture';
import { probeForm } from '@/diagnostics/formProbe';
import {
  assertNoLeakedSecrets,
  findLeakedSecrets,
  normalizeIdPattern,
  normalizeNamePattern,
} from '@/diagnostics/redact';

const PLANTED_SECRETS = {
  email: 'ada.lovelace.secret@example.org',
  givenName: 'Ada',
  familyName: 'Lovelace',
  password: 'hunter2_super_secret',
  csrf: 'csrf_token_abc123XYZ789',
  manuscriptTitle: 'Novel CRISPR Base Editing in Arabidopsis thaliana',
  manuscriptId: 'MS-2024-SECRET-99182',
  linkedPid: 'portal_pid_88442211',
  cookie: 'session_cookie_deadbeef01234567',
};

function mountPiiFixture(): void {
  document.body.innerHTML = `
    <form id="author_form">
      <input type="hidden" name="csrfmiddlewaretoken" value="${PLANTED_SECRETS.csrf}" />
      <input type="hidden" name="session_cookie" value="${PLANTED_SECRETS.cookie}" />
      <input type="password" name="password" value="${PLANTED_SECRETS.password}" />
      <label for="manuscript_title">Manuscript Title</label>
      <input id="manuscript_title" name="manuscript_title" type="text"
        value="${PLANTED_SECRETS.manuscriptTitle}" />
      <input id="manuscript_id" name="manuscript_id" type="text"
        value="${PLANTED_SECRETS.manuscriptId}" />
      <label for="contrib_auth_1_email">Email</label>
      <input id="contrib_auth_1_email" type="text" value="${PLANTED_SECRETS.email}" />
      <label for="contrib_auth_1_first_nm">First Name</label>
      <input id="contrib_auth_1_first_nm" type="text" value="${PLANTED_SECRETS.givenName}" />
      <label for="contrib_auth_1_last_nm">Last Name</label>
      <input id="contrib_auth_1_last_nm" type="text" value="${PLANTED_SECRETS.familyName}" />
      <input id="current_contrib_auth_1_author_pid" type="hidden"
        value="${PLANTED_SECRETS.linkedPid}" />
    </form>
  `;
  document.title = `Submit | ${PLANTED_SECRETS.manuscriptTitle}`;
}

const ALL_PLANTED = Object.values(PLANTED_SECRETS);

describe('redact helpers', () => {
  it('normalizes digit runs in id and name patterns', () => {
    expect(normalizeIdPattern('contrib_auth_12_email')).toBe('contrib_auth_#_email');
    expect(normalizeNamePattern('authors[3][given]')).toBe('authors[#][given]');
  });
});

describe('compatibility capture redaction', () => {
  it('exports structural capture with redactionComplete and no planted PII', () => {
    mountPiiFixture();
    const capture = captureForm(document, {
      url: `https://mts.nature.com/submit?csrf=${PLANTED_SECRETS.csrf}&manuscript=${PLANTED_SECRETS.manuscriptId}`,
    });

    expect(capture.redactionComplete).toBe(true);
    expect(capture.notes.length).toBeGreaterThan(0);
    expect(capture.structuralFields.some((f) => f.idPattern === 'contrib_auth_#_email')).toBe(true);
    expect(capture.structuralFields.some((f) => f.labelText === 'Email')).toBe(true);
    expect(capture.structuralFields.some((f) => f.category === 'email')).toBe(true);
    expect(capture.structuralFields.find((f) => f.idPattern === 'contrib_auth_#_first_nm')?.required).toBe(false);

    const json = JSON.stringify(capture);
    const preview = previewCapture(capture);
    assertNoLeakedSecrets(json, ALL_PLANTED);
    assertNoLeakedSecrets(preview, ALL_PLANTED);
    expect(json).not.toContain('hunter2');
    expect(capture.structuralFields.every((f) => !('value' in f))).toBe(true);
  });

  it('probeForm wraps capture and keeps legacyFields redacted', () => {
    mountPiiFixture();
    const report = probeForm(document, { url: location.href });
    expect(report.redactionComplete).toBe(true);
    expect(report.fields.length).toBeGreaterThan(0);
    const email = report.fields.find((f) => f.idPattern === 'contrib_auth_#_email');
    expect(email?.redacted).toBe(true);
    expect(email?.value).toBeUndefined();
    const pwd = report.fields.find((f) => f.category === 'auth_secret');
    expect(pwd?.value).toBeUndefined();

    const exported = JSON.stringify(report) + previewCapture(report);
    assertNoLeakedSecrets(exported, ALL_PLANTED);
  });

  it('nature-mts synthetic HTML capture preserves labels and option structure', () => {
    document.body.innerHTML = buildNatureMtsFixtureHtml({
      slots: 2,
      authors: [
        {
          first: PLANTED_SECRETS.givenName,
          last: PLANTED_SECRETS.familyName,
          email: PLANTED_SECRETS.email,
          country: 'Japan',
        },
        {
          first: 'Grace',
          last: 'Hopper',
          email: 'grace.hopper@example.org',
        },
      ],
    });

    const capture = captureForm(document);
    const labels = capture.structuralFields.map((f) => f.labelText).filter(Boolean);
    expect(labels.some((l) => /contributing author/i.test(l ?? ''))).toBe(true);

    const country = capture.structuralFields.find((f) => f.idPattern === 'contrib_auth_#_country');
    expect(country?.optionLabels).toContain('Japan');
    expect(country?.optionLabels).toContain('United States');

    const exported = JSON.stringify(capture) + previewCapture(capture);
    const leaks = findLeakedSecrets(exported, ALL_PLANTED);
    expect(leaks).toEqual([]);
  });
});
