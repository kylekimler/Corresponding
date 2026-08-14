import { describe } from 'vitest';
import { editorialManagerAdapter } from '@/adapters/editorial-manager/adapter';
import { mountEditorialManagerFixture } from '@/adapters/editorial-manager/fixture';
import { describeAdapterContract } from './contract';

describe('Editorial Manager adapter contract', () => {
  describeAdapterContract({
    adapter: editorialManagerAdapter,
    mountBlank: (slots) => {
      mountEditorialManagerFixture({ slots, includeSubmitControls: true });
    },
    mountLinkedConflict: () => {
      mountEditorialManagerFixture({
        slots: 1,
        includeSubmitControls: true,
        authors: [
          {
            first: 'Portal',
            last: 'Linked',
            email: 'portal@example.org',
            linkedPid: 'EM-PEOPLE-CONTRACT',
          },
        ],
      });
    },
    readName: (slot) => ({
      first: (
        document.getElementById(
          `em_author_${slot}_given_first_name`,
        ) as HTMLInputElement
      ).value,
      last: (
        document.getElementById(
          `em_author_${slot}_family_last_name`,
        ) as HTMLInputElement
      ).value,
    }),
    readCountry: (slot) =>
      (
        document.getElementById(
          `em_author_${slot}_country`,
        ) as HTMLSelectElement
      ).value,
  });
});
