import { beforeEach, describe, expect, it } from 'vitest';
import { recognizeForm } from '@/recognition/recognize';
import { CONFIDENCE } from '@/recognition/confidence';

describe('semantic recognizer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('recognizes clear labels without using values', () => {
    document.body.innerHTML = `
      <label for="fn">First Name</label>
      <input id="fn" name="first_name" value="SECRET_SHOULD_NOT_MATTER" />
      <label for="ln">Last Name</label>
      <input id="ln" name="last_name" value="ALSO_SECRET" />
      <label for="em">Email</label>
      <input id="em" type="email" name="email" value="leak@example.org" />
      <label for="orcid">ORCID</label>
      <input id="orcid" name="orcid" />
      <label for="inst">Institution</label>
      <input id="inst" name="institution" />
      <label for="city">City</label>
      <input id="city" name="city" />
      <label for="country">Country</label>
      <select id="country" name="country">
        <option></option><option>United States</option><option>Germany</option>
        <option>Japan</option><option>France</option><option>Canada</option>
      </select>
    `;
    const report = recognizeForm(document);
    const byField = new Map(
      report.proposals
        .filter((p) => p.canonicalField !== 'unknown')
        .map((p) => [p.canonicalField, p]),
    );
    expect(byField.get('givenName')?.confidence).toBeGreaterThanOrEqual(
      CONFIDENCE.fillThreshold,
    );
    expect(byField.get('familyName')?.unresolved).toBe(false);
    expect(byField.get('email')?.evidence.join(' ')).not.toContain('leak');
    expect(byField.get('orcid')?.canonicalField).toBe('orcid');
    expect(byField.get('country')?.confidence).toBeGreaterThanOrEqual(
      CONFIDENCE.fillThreshold,
    );
  });

  it('leaves ambiguous soft matches unresolved', () => {
    document.body.innerHTML = `
      <input id="x1" name="contact" aria-label="Contact" />
      <input id="x2" name="place" aria-label="Place" />
    `;
    const report = recognizeForm(document);
    expect(report.fillable.length).toBe(0);
    expect(report.unresolved.length).toBeGreaterThan(0);
  });

  it('never classifies password fields', () => {
    document.body.innerHTML = `
      <label for="pw">Password</label>
      <input id="pw" type="password" name="password" />
      <label for="fn">First Name</label>
      <input id="fn" name="first_name" />
    `;
    const report = recognizeForm(document);
    expect(report.fields.some((f) => f.inputType === 'password')).toBe(false);
  });
});
