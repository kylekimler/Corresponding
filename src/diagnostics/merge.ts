/**
 * Merge redacted compatibility captures from multiple tab frames.
 */

import {
  captureGuidanceNotes,
  previewCapture,
  type CaptureControl,
  type CaptureField,
  type CompatibilityCapture,
} from './capture';
import type { DiagnosticField, DiagnosticReport } from './formProbe';
import { emptyFrameInventory, type FrameInventory } from './frames';
import { evaluateRedactionComplete } from './redact';

function fieldKey(field: CaptureField): string {
  return [
    field.tag,
    field.inputType ?? '',
    field.idPattern ?? '',
    field.namePattern ?? '',
    field.labelText ?? '',
    field.category,
  ].join('|');
}

function controlKey(control: CaptureControl): string {
  return [
    control.tag,
    control.inputType ?? '',
    control.idPattern ?? '',
    control.namePattern ?? '',
    control.actionLabel ?? '',
    control.category,
  ].join('|');
}

function legacyFieldKey(field: DiagnosticField): string {
  return [
    field.tag,
    field.inputType ?? '',
    field.idPattern ?? '',
    field.namePattern ?? '',
    field.labelText ?? '',
    field.category,
  ].join('|');
}

function uniqueBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function mergeFrameInventories(inventories: FrameInventory[]): FrameInventory {
  const frames = inventories.flatMap((inventory) => inventory.frames);
  const blocked = frames.filter((frame) => !frame.readable).length;
  return {
    seen: frames.length,
    readable: frames.length - blocked,
    blocked,
    frames,
  };
}

function pickUrlPattern(captures: CompatibilityCapture[]): string | undefined {
  const withAuthors = captures.find((capture) =>
    capture.structuralFields.some((field) =>
      ['author', 'email', 'affiliation', 'orcid', 'corresponding'].includes(
        field.category,
      ),
    ),
  );
  return (withAuthors ?? captures[0])?.urlPattern;
}

export function mergeCompatibilityCaptures(
  captures: CompatibilityCapture[],
): CompatibilityCapture {
  if (captures.length === 0) {
    throw new Error('Cannot merge an empty capture list');
  }
  if (captures.length === 1) {
    return captures[0]!;
  }

  const structuralFields = uniqueBy(
    captures.flatMap((capture) => capture.structuralFields),
    fieldKey,
  );
  const controls = uniqueBy(
    captures.flatMap((capture) => capture.controls),
    controlKey,
  );
  const frames = mergeFrameInventories(
    captures.map((capture) => capture.frames ?? emptyFrameInventory()),
  );
  const urlPattern = pickUrlPattern(captures);
  const authorGroupCount = captures.reduce(
    (sum, capture) => sum + capture.structure.authorGroupCount,
    0,
  );
  const repeatedGroups = captures.flatMap(
    (capture) => capture.structure.repeatedGroups,
  );
  const baseNotes = [
    'Structural capture only — field values are never exported.',
    'IDs and names are normalized (# replaces digits) for safe sharing.',
    'Password, token, CSRF, cookie, and hidden auth fields are omitted.',
    'Same-origin iframes are walked; cross-origin frames are counted but not read.',
    `Merged ${captures.length} injectable frame captures from the active tab.`,
    'Share this capture when requesting support for a new journal portal.',
  ];

  const draft: CompatibilityCapture = {
    capturedAt: captures[0]!.capturedAt,
    redactionComplete: true,
    notes: [
      ...baseNotes,
      ...captureGuidanceNotes(structuralFields, frames, urlPattern),
    ],
    fieldCount: structuralFields.length,
    controlCount: controls.length,
    structuralFields,
    controls,
    structure: {
      repeatedGroups,
      authorGroupCount,
    },
    frames,
    urlPattern,
    titleSafe: captures[0]?.titleSafe,
  };

  const preview = previewCapture({ ...draft, redactionComplete: true });
  draft.redactionComplete = evaluateRedactionComplete(preview);
  if (!draft.redactionComplete) {
    draft.notes = [
      ...draft.notes,
      'WARNING: residual sensitive patterns detected; treat export as incomplete.',
    ];
  }
  return draft;
}

export function mergeDiagnosticReports(
  reports: DiagnosticReport[],
): DiagnosticReport {
  const capture = mergeCompatibilityCaptures(reports);
  return {
    ...capture,
    url: capture.urlPattern,
    title: capture.titleSafe,
    fields: uniqueBy(
      reports.flatMap((report) => report.fields),
      legacyFieldKey,
    ),
  };
}
