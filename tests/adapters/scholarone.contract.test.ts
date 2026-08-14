import { describe } from 'vitest';
import { scholarOneAdapter } from '@/adapters/scholarone/adapter';
import { mountScholarOneFixture } from '@/adapters/scholarone/fixture';
import { describeAdapterContract } from './contract';

describe('ScholarOne adapter contract', () => {
  describeAdapterContract({
    adapter: scholarOneAdapter,
    mountBlank: (slots) => {
      mountScholarOneFixture({ slots, includeSubmitControls: true });
    },
    mountLinkedConflict: () => {
      mountScholarOneFixture({
        slots: 1,
        includeSubmitControls: true,
        authors: [
          {
            first: 'Portal',
            last: 'Linked',
            email: 'portal@example.org',
            linkedPid: 'S1-USER-CONTRACT',
          },
        ],
      });
    },
    readName: (slot) => ({
      first: (
        document.getElementById(
          `s1_author_${slot}_first_name`,
        ) as HTMLInputElement
      ).value,
      last: (
        document.getElementById(
          `s1_author_${slot}_last_name`,
        ) as HTMLInputElement
      ).value,
    }),
    readCountry: (slot) =>
      (
        document.getElementById(
          `s1_author_${slot}_country`,
        ) as HTMLSelectElement
      ).value,
  });
});
