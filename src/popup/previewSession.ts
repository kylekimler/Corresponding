import type { FillReport } from '@/adapters/types';
import type { Roster } from '@/schema/author';

export interface TabTarget {
  tabId: number;
  url: string;
}

export interface PreviewContext extends TabTarget {
  rosterId: string;
  rosterUpdatedAt: string;
  overwrite: boolean;
}

export interface PreviewSession {
  report: FillReport;
  context: PreviewContext;
}

export function createPreviewContext(
  roster: Pick<Roster, 'id' | 'updatedAt'>,
  overwrite: boolean,
  target: TabTarget,
): PreviewContext {
  return {
    rosterId: roster.id,
    rosterUpdatedAt: roster.updatedAt,
    overwrite,
    tabId: target.tabId,
    url: target.url,
  };
}

export function previewMatchesContext(
  session: PreviewSession | null,
  roster: Pick<Roster, 'id' | 'updatedAt'> | null,
  overwrite: boolean,
  target: TabTarget | null,
): boolean {
  if (!session || !session.report.dryRun || !roster || !target) return false;
  const context = session.context;
  return (
    context.rosterId === roster.id &&
    context.rosterUpdatedAt === roster.updatedAt &&
    context.overwrite === overwrite &&
    context.tabId === target.tabId &&
    context.url === target.url
  );
}
