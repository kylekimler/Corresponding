import { defaultRegistry } from '@/adapters/registry';
import { probeForm } from '@/diagnostics/formProbe';
import type { ExtensionRequest, ExtensionResponse } from '@/messaging/protocol';

export default defineContentScript({
  // Built as a file for on-demand injection via activeTab + scripting.executeScript.
  // Placeholder matches satisfy WXT; stripped from the shipped manifest in wxt.config.ts
  // so we do not gain automatic injection or broad host permissions.
  matches: ['http://localhost/*'],
  runAt: 'document_idle',
  registration: 'manifest',
  main() {
    browser.runtime.onMessage.addListener(
      (message: unknown): ExtensionResponse | undefined => {
        const msg = message as ExtensionRequest;
        try {
          switch (msg.type) {
            case 'PING':
              return { type: 'PONG' };
            case 'DETECT':
              return {
                type: 'DETECT_RESULT',
                result: defaultRegistry.detect(document),
              };
            case 'INSPECT':
              return {
                type: 'INSPECT_RESULT',
                result: (() => {
                  const detected = defaultRegistry.detect(document);
                  const adapter = defaultRegistry.get(detected.platformId);
                  if (!adapter) {
                    return {
                      platformId: 'unknown' as const,
                      authorSlots: 0,
                      linkedAuthorPids: [],
                      fields: [],
                      dangerousControls: [],
                    };
                  }
                  return adapter.inspect(document);
                })(),
              };
            case 'PREVIEW': {
              const detected = defaultRegistry.detect(document);
              if (detected.platformId === 'unknown') {
                return {
                  type: 'ERROR',
                  message:
                    'Unsupported platform. Run diagnostics to capture a redacted form map.',
                };
              }
              const adapter = defaultRegistry.require(detected.platformId);
              const result = adapter.fill(document, msg.roster, {
                overwrite: msg.overwrite,
                dryRun: true,
              });
              return { type: 'FILL_RESULT', result };
            }
            case 'FILL': {
              const detected = defaultRegistry.detect(document);
              if (detected.platformId === 'unknown') {
                return {
                  type: 'ERROR',
                  message:
                    'Unsupported platform. Run diagnostics to capture a redacted form map.',
                };
              }
              const adapter = defaultRegistry.require(detected.platformId);
              const result = adapter.fill(document, msg.roster, {
                overwrite: msg.overwrite,
                dryRun: false,
              });
              return { type: 'FILL_RESULT', result };
            }
            case 'VALIDATE': {
              const detected = defaultRegistry.detect(document);
              if (detected.platformId === 'unknown') {
                return {
                  type: 'ERROR',
                  message: 'Unsupported platform for validation.',
                };
              }
              const adapter = defaultRegistry.require(detected.platformId);
              return {
                type: 'VALIDATE_RESULT',
                result: adapter.validate(document, msg.roster),
              };
            }
            case 'DIAGNOSTIC':
              return {
                type: 'DIAGNOSTIC_RESULT',
                result: probeForm(document, {
                  url: location.href,
                  includeValues: false,
                }),
              };
            default:
              return { type: 'ERROR', message: 'Unknown message type' };
          }
        } catch (err) {
          return {
            type: 'ERROR',
            message: err instanceof Error ? err.message : String(err),
          };
        }
      },
    );
  },
});
