import { startContextualAutofill } from '@/autofill/controller';
import { AUTOFILL_CONTENT_SCRIPT_MATCHES } from '@/autofill/hosts';
import { loadActiveRoster, subscribeRosterChanges } from '@/autofill/rosterState';
import { installPageBridge } from '@/messaging/pageBridge';

/**
 * Thin contextual UI over the existing adapter fill path.
 * Runs only on known submission hosts and local fixtures.
 */
export default defineContentScript({
  matches: [...AUTOFILL_CONTENT_SCRIPT_MATCHES],
  allFrames: true,
  runAt: 'document_idle',
  main() {
    installPageBridge();
    startContextualAutofill({
      document,
      getActiveRoster: loadActiveRoster,
      subscribeRoster: subscribeRosterChanges,
      isTopFrame: window === window.top,
    });
  },
});
