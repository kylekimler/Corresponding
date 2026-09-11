import { installPageBridge } from '@/messaging/pageBridge';

export default defineContentScript({
  // Official WXT on-demand mode: build the script without manifest registration.
  // The popup injects it only into the active tab via scripting.executeScript
  // when contextual autofill is not already present.
  registration: 'runtime',
  runAt: 'document_idle',
  main() {
    installPageBridge();
  },
});
