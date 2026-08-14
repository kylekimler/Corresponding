import { defaultRegistry } from '@/adapters/registry';
import { probeForm } from '@/diagnostics/formProbe';
import type { ExtensionResponse } from './protocol';
import { parseExtensionRequest } from './validate';

/** Request handler shared by the injected Chrome message listener. */
export async function handleExtensionRequest(
  message: unknown,
  doc: Document,
  pageUrl: string,
): Promise<ExtensionResponse> {
  const parsed = parseExtensionRequest(message);
  if (!parsed.ok) {
    return { type: 'ERROR', message: parsed.error };
  }

  const msg = parsed.request;
  try {
    switch (msg.type) {
      case 'PING':
        return { type: 'PONG' };
      case 'DETECT':
        return {
          type: 'DETECT_RESULT',
          result: defaultRegistry.detect(doc, pageUrl),
        };
      case 'INSPECT': {
        const detected = defaultRegistry.detect(doc, pageUrl);
        const adapter = defaultRegistry.get(detected.platformId);
        return {
          type: 'INSPECT_RESULT',
          result: adapter
            ? adapter.inspect(doc)
            : {
                platformId: 'unknown',
                authorSlots: 0,
                linkedAuthorPids: [],
                fields: [],
                dangerousControls: [],
              },
        };
      }
      case 'PREVIEW': {
        const detected = defaultRegistry.detect(doc, pageUrl);
        if (detected.platformId === 'unknown') {
          return {
            type: 'ERROR',
            message:
              'Unsupported platform. Run diagnostics to capture a redacted form map.',
          };
        }
        const adapter = defaultRegistry.require(detected.platformId);
        const result = adapter.fill(doc, msg.roster, {
          overwrite: msg.overwrite,
          dryRun: true,
        });
        return {
          type: 'FILL_RESULT',
          result,
        };
      }
      case 'FILL': {
        const detected = defaultRegistry.detect(doc, pageUrl);
        if (detected.platformId === 'unknown') {
          return {
            type: 'ERROR',
            message:
              'Unsupported platform. Run diagnostics to capture a redacted form map.',
          };
        }
        const adapter = defaultRegistry.require(detected.platformId);
        const options = {
          overwrite: msg.overwrite,
          dryRun: false,
        };
        const result = adapter.fillAsync
          ? await adapter.fillAsync(doc, msg.roster, options)
          : adapter.fill(doc, msg.roster, options);
        return {
          type: 'FILL_RESULT',
          result,
        };
      }
      case 'VALIDATE': {
        const detected = defaultRegistry.detect(doc, pageUrl);
        if (detected.platformId === 'unknown') {
          return {
            type: 'ERROR',
            message: 'Unsupported platform for validation.',
          };
        }
        const adapter = defaultRegistry.require(detected.platformId);
        return {
          type: 'VALIDATE_RESULT',
          result: adapter.validate(doc, msg.roster),
        };
      }
      case 'DIAGNOSTIC':
        return {
          type: 'DIAGNOSTIC_RESULT',
          result: probeForm(doc, {
            url: pageUrl,
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
}
