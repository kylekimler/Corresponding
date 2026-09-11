import type { DetectResult } from '@/adapters/types';
import type { Author, Roster } from '@/schema/author';
import { recognizeAuthorField } from './fields';
import { runContextualFill } from './fill';
import {
  detectContextualPage,
  pageSupportsContextualAutofill,
  shouldShowPageChip,
} from './page';
import { suggestAuthor } from './suggest';
import { createAutofillUi, type AutofillUi } from './ui';

export type AutofillControllerOptions = {
  document: Document;
  pageUrl?: string;
  getActiveRoster: () => Promise<Roster | undefined>;
  subscribeRoster?: (listener: () => void) => () => void;
  isTopFrame?: boolean;
  debounceMs?: number;
  blurDelayMs?: number;
  fill?: typeof runContextualFill;
};

export type AutofillController = {
  refresh: () => Promise<void>;
  destroy: () => void;
  ui: AutofillUi;
};

function isOurEventTarget(target: EventTarget | null, host: HTMLElement): boolean {
  if (!(target instanceof Node)) return false;
  return host === target || host.contains(target) || host.shadowRoot?.contains(target) === true;
}

export function startContextualAutofill(
  options: AutofillControllerOptions,
): AutofillController {
  const doc = options.document;
  const ui = createAutofillUi(doc);
  const fill = options.fill ?? runContextualFill;
  const debounceMs = options.debounceMs ?? 150;
  const blurDelayMs = options.blurDelayMs ?? 180;
  const isTopFrame =
    options.isTopFrame ??
    Boolean(doc.defaultView && doc.defaultView === doc.defaultView.top);

  let roster: Roster | undefined;
  let detect: DetectResult | null = null;
  let focused: Element | null = null;
  let focusedAuthor: Author | undefined;
  let destroyed = false;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let blurTimer: ReturnType<typeof setTimeout> | undefined;
  let busy: 'one' | 'all' | null = null;
  let error: string | undefined;
  let completedAll = false;
  let rosterStamp: string | undefined;
  let refreshVersion = 0;

  const pageUrl = () =>
    options.pageUrl ?? doc.defaultView?.location.href ?? '';

  const hideField = () => {
    focused = null;
    focusedAuthor = undefined;
    ui.hideFieldCard();
  };

  const render = () => {
    if (destroyed) return;
    const authorCount = roster?.authors.length ?? 0;
    const pageOk = detect ? pageSupportsContextualAutofill(detect) : false;

    if (
      !completedAll &&
      shouldShowPageChip(
        detect ?? {
          platformId: 'unknown',
          confidence: 0,
          label: '',
          evidence: [],
        },
        authorCount,
        isTopFrame,
      )
    ) {
      ui.showPageChip({
        authorCount,
        busy: busy === 'all',
        error: busy === 'all' ? undefined : error,
        onFillAll: () => {
          void runFill('all');
        },
      });
    } else {
      ui.hidePageChip();
    }

    if (!pageOk || !roster || !focused || !focused.isConnected) {
      if (focused && !focused.isConnected) hideField();
      else if (!pageOk || !roster) ui.hideFieldCard();
      return;
    }

    const recognized = recognizeAuthorField(focused);
    // A modal's fields do not identify which roster author belongs there.
    // Offer the adapter's full workflow instead of guessing the first person.
    if (recognized && !recognized.sequence && !recognized.corresponding) {
      ui.hideFieldCard();
      return;
    }
    focusedAuthor = recognized ? suggestAuthor(roster, recognized) : undefined;
    if (!recognized || !focusedAuthor) {
      ui.hideFieldCard();
      return;
    }
    ui.showFieldCard({
      author: focusedAuthor,
      anchor: focused,
      busy: busy === 'one',
      error: busy === 'one' ? undefined : error,
      onFillOne: () => {
        void runFill('one');
      },
    });
  };

  const runFill = async (mode: 'one' | 'all') => {
    if (!roster || busy) return;
    error = undefined;
    busy = mode;
    render();
    const author = mode === 'one' ? focusedAuthor : undefined;
    let result;
    try {
      result = await fill(doc, roster, {
      mode,
      author,
      pageUrl: pageUrl(),
      overwrite: false,
      });
    } catch {
      result = { ok: false as const, reason: 'Fill was interrupted. Review the journal fields, then use the extension to continue.' };
    }
    busy = null;
    if (destroyed) return;
    if (result.ok) {
      error = undefined;
      hideField();
      if (mode === 'all') {
        completedAll = true;
        ui.hidePageChip();
      }
      return;
    }
    error = result.reason;
    render();
  };

  const refresh = async () => {
    if (destroyed) return;
    const version = ++refreshVersion;
    let nextRoster;
    try { nextRoster = await options.getActiveRoster(); } catch { nextRoster = undefined; }
    if (destroyed || version !== refreshVersion) return;
    roster = nextRoster;
    const stamp = roster ? `${roster.id}:${roster.updatedAt}:${roster.authors.length}` : '';
    if (stamp !== rosterStamp) {
      completedAll = false;
      rosterStamp = stamp;
    }
    detect = detectContextualPage(doc, pageUrl());
    render();
  };

  const scheduleRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      void refresh();
    }, debounceMs);
  };

  const onFocusIn = (event: Event) => {
    if (isOurEventTarget(event.target, ui.host)) return;
    if (!(event.target instanceof Element)) return;
    clearTimeout(blurTimer);
    focused = event.target;
    error = undefined;
    render();
  };

  const onFocusOut = (event: FocusEvent) => {
    if (isOurEventTarget(event.relatedTarget, ui.host)) return;
    clearTimeout(blurTimer);
    blurTimer = setTimeout(() => {
      const active = doc.activeElement;
      if (active && recognizeAuthorField(active) && roster) {
        focused = active;
        render();
        return;
      }
      hideField();
    }, blurDelayMs);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') hideField();
  };

  const onPageHide = () => {
    hideField();
    ui.hidePageChip();
  };
  const onNavigate = () => {
    onPageHide();
    completedAll = false;
    scheduleRefresh();
  };

  doc.addEventListener('focusin', onFocusIn, true);
  doc.addEventListener('focusout', onFocusOut, true);
  doc.addEventListener('keydown', onKeyDown, true);
  doc.defaultView?.addEventListener('pagehide', onPageHide);
  doc.defaultView?.addEventListener('popstate', onNavigate);
  doc.defaultView?.addEventListener('hashchange', onNavigate);
  doc.defaultView?.addEventListener('pageshow', scheduleRefresh);

  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.target !== ui.host && !ui.host.contains(record.target))) scheduleRefresh();
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'disabled', 'readonly', 'aria-hidden', 'class', 'style'] });

  const unsubscribe = options.subscribeRoster?.(scheduleRefresh);

  void refresh();

  return {
    refresh,
    ui,
    destroy() {
      destroyed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (blurTimer) clearTimeout(blurTimer);
      observer.disconnect();
      unsubscribe?.();
      doc.removeEventListener('focusin', onFocusIn, true);
      doc.removeEventListener('focusout', onFocusOut, true);
      doc.removeEventListener('keydown', onKeyDown, true);
      doc.defaultView?.removeEventListener('pagehide', onPageHide);
      doc.defaultView?.removeEventListener('popstate', onNavigate);
      doc.defaultView?.removeEventListener('hashchange', onNavigate);
      doc.defaultView?.removeEventListener('pageshow', scheduleRefresh);
      ui.destroy();
    },
  };
}
