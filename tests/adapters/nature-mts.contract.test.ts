import { describe } from 'vitest';
import { natureMtsAdapter } from '@/adapters/nature-mts/adapter';
import { mountNatureMtsFixture } from '@/adapters/nature-mts/fixture';
import { describeAdapterContract } from './contract';

describe('Nature MTS adapter contract', () => {
  describeAdapterContract({
    adapter: natureMtsAdapter,
    mountBlank: (slots) => {
      mountNatureMtsFixture({ slots, includeSubmitControls: true });
    },
    mountLinkedConflict: () => {
      mountNatureMtsFixture({
        slots: 1,
        includeSubmitControls: true,
        authors: [
          {
            first: 'Portal',
            last: 'Linked',
            email: 'portal@example.org',
            linkedPid: 'PID-CONTRACT',
          },
        ],
      });
    },
    readName: (slot) => ({
      first: (
        document.getElementById(
          `contrib_auth_${slot}_first_nm`,
        ) as HTMLInputElement
      ).value,
      last: (
        document.getElementById(
          `contrib_auth_${slot}_last_nm`,
        ) as HTMLInputElement
      ).value,
    }),
    readCountry: (slot) =>
      (
        document.getElementById(
          `contrib_auth_${slot}_country`,
        ) as HTMLSelectElement
      ).value,
  });
});
