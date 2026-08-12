import type { FillOptions, FillReport, ValidateReport, DetectResult, InspectReport } from '@/adapters/types';
import type { Roster } from '@/schema/author';
import type { DiagnosticReport } from '@/diagnostics/formProbe';

export type ExtensionRequest =
  | { type: 'PING' }
  | { type: 'DETECT' }
  | { type: 'INSPECT' }
  | { type: 'PREVIEW'; roster: Roster; overwrite: boolean }
  | { type: 'FILL'; roster: Roster; overwrite: boolean }
  | { type: 'VALIDATE'; roster: Roster }
  | { type: 'DIAGNOSTIC' };

export type ExtensionResponse =
  | { type: 'PONG' }
  | { type: 'DETECT_RESULT'; result: DetectResult }
  | { type: 'INSPECT_RESULT'; result: InspectReport }
  | { type: 'FILL_RESULT'; result: FillReport }
  | { type: 'VALIDATE_RESULT'; result: ValidateReport }
  | { type: 'DIAGNOSTIC_RESULT'; result: DiagnosticReport }
  | { type: 'ERROR'; message: string };

export type { FillOptions };
