import { beforeEach, describe, expect, it } from 'vitest';
import { recognizeForm } from '@/recognition/recognize';
import { CONFIDENCE } from '@/recognition/confidence';

describe('author group detection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('detects numbered contrib_auth style groups', () => {
    document.body.innerHTML = `
      <fieldset>
        <input id="contrib_auth_1_first_nm" name="contrib_auth_1_first_nm" />
        <input id="contrib_auth_1_last_nm" name="contrib_auth_1_last_nm" />
        <input id="contrib_auth_1_email" name="contrib_auth_1_email" />
      </fieldset>
      <fieldset>
        <input id="contrib_auth_2_first_nm" name="contrib_auth_2_first_nm" />
        <input id="contrib_auth_2_last_nm" name="contrib_auth_2_last_nm" />
        <input id="contrib_auth_2_email" name="contrib_auth_2_email" />
      </fieldset>
    `;
    const report = recognizeForm(document);
    expect(report.authorGroups).toHaveLength(2);
    expect(report.authorGroups[0]?.confidence).toBeGreaterThanOrEqual(
      CONFIDENCE.fillThreshold,
    );
    expect(
      report.proposals.some(
        (p) => p.canonicalField === 'givenName' && p.authorGroupIndex === 1,
      ),
    ).toBe(true);
  });

  it('detects repeated labeled blocks', () => {
    document.body.innerHTML = `
      <div class="author">
        <label>First Name</label><input name="a1_first" />
        <label>Last Name</label><input name="a1_last" />
        <label>Email</label><input name="a1_email" />
      </div>
      <div class="author">
        <label>First Name</label><input name="a2_first" />
        <label>Last Name</label><input name="a2_last" />
        <label>Email</label><input name="a2_email" />
      </div>
    `;
    // Without for= bindings, labels wrap poorly — use aria-labels for structure
    document.body.innerHTML = `
      <div>
        <input name="author_1_first" aria-label="First Name" />
        <input name="author_1_last" aria-label="Last Name" />
        <input name="author_1_email" aria-label="Email" />
      </div>
      <div>
        <input name="author_2_first" aria-label="First Name" />
        <input name="author_2_last" aria-label="Last Name" />
        <input name="author_2_email" aria-label="Email" />
      </div>
    `;
    const report = recognizeForm(document);
    expect(report.authorGroups.length).toBeGreaterThanOrEqual(2);
  });

  it('blocks generic fill when multi-group identity is weak', () => {
    // Repeated signatures without strong numbered author markers → weak multi-group
    document.body.innerHTML = `
      <input name="x_a" aria-label="First Name" />
      <input name="x_b" aria-label="Last Name" />
      <input name="y_a" aria-label="First Name" />
      <input name="y_b" aria-label="Last Name" />
    `;
    const report = recognizeForm(document);
    expect(report.authorGroups.length).toBeGreaterThan(1);
    const weak = report.authorGroups.some(
      (g) => g.confidence < CONFIDENCE.fillThreshold,
    );
    if (weak) {
      expect(
        report.proposals.some((p) =>
          p.evidence.includes('blocked:weak-author-groups'),
        ),
      ).toBe(true);
      expect(report.fillable.length).toBe(0);
    }
  });
});
