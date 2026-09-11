import { authorPreview, fillAllLabel } from './suggest';
import type { Author } from '@/schema/author';

export const AUTOFILL_HOST_ID = 'corresponding-autofill-root';
export const PAGE_CHIP_ATTR = 'data-corresponding-chip';
export const FIELD_CARD_ATTR = 'data-corresponding-field';
export const REVIEW_NOTICE_ATTR = 'data-corresponding-review';

const HOST_STYLE = [
  'all: initial',
  'position: fixed',
  'inset: 0',
  'z-index: 2147483646',
  'pointer-events: none',
  'display: block',
].join(';');

const SHADOW_CSS = `
:host { all: initial; }
.c-root {
  position: fixed;
  inset: 0;
  pointer-events: none;
  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
  font-size: 12px;
  line-height: 1.35;
  color: #1f2a24;
}
.c-chip, .c-card {
  pointer-events: auto;
  position: fixed;
  background: #f6f1e8;
  color: #1f2a24;
  border: 1px solid rgba(36, 48, 42, 0.18);
  box-shadow: 0 1px 4px rgba(31, 42, 36, 0.12);
  opacity: 1;
}
.c-chip {
  left: 16px;
  bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 7px;
  border-radius: 999px;
  max-width: min(360px, calc(100vw - 32px));
}
.c-card {
  width: 220px;
  padding: 8px 10px 9px;
  border-radius: 8px;
}
.c-mark {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: #0d6b56;
  color: #f4fffa;
  font: 700 10px/16px "IBM Plex Sans", "Segoe UI", sans-serif;
  text-align: center;
}
.c-copy {
  min-width: 0;
  color: #1f2a24;
}
.c-kicker {
  color: #5c6b63;
  font-size: 10px;
  letter-spacing: 0.01em;
}
.c-name, .c-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.c-name { font-weight: 600; }
.c-meta { color: #5c6b63; }
.c-btn {
  appearance: none;
  border: 1px solid #0d6b56;
  background: #0d6b56;
  color: #f4fffa;
  border-radius: 999px;
  padding: 3px 8px;
  font: 600 11px/1.2 "IBM Plex Sans", "Segoe UI", sans-serif;
  cursor: pointer;
  white-space: nowrap;
}
.c-btn:disabled {
  opacity: 0.55;
  cursor: default;
}
.c-btn-ghost {
  background: transparent;
  color: #0d6b56;
}
.c-error { color: #8b1e1e; }
.c-review { align-items: flex-start; border-radius: 8px; box-sizing: border-box; }
.c-review strong { display: block; font-weight: 600; }
.c-review details { margin-top: 4px; }
.c-review summary { cursor: pointer; color: #0d6b56; }
.c-review ul { padding-left: 16px; margin: 6px 0 0; max-height: 180px; overflow: auto; }
.c-review li + li { margin-top: 6px; }
`;

export type AutofillUi = {
  host: HTMLElement;
  shadow: ShadowRoot;
  showPageChip(options: {
    authorCount: number;
    busy?: boolean;
    error?: string;
    onFillAll: () => void;
  }): void;
  hidePageChip(): void;
  showReviewNotice(options: { messages: string[]; onDismiss: () => void }): void;
  hideReviewNotice(): void;
  showFieldCard(options: {
    author: Author;
    anchor: Element;
    busy?: boolean;
    error?: string;
    onFillOne: () => void;
  }): void;
  hideFieldCard(): void;
  destroy(): void;
};

function ensureHost(doc: Document): HTMLElement {
  const existing = doc.getElementById(AUTOFILL_HOST_ID);
  if (existing) return existing;
  const host = doc.createElement('div');
  host.id = AUTOFILL_HOST_ID;
  host.setAttribute('data-corresponding-autofill', 'root');
  host.style.cssText = HOST_STYLE;
  doc.documentElement.appendChild(host);
  return host;
}

function positionFieldCard(
  card: HTMLElement,
  anchor: Element,
  view: Window,
): void {
  const rect = anchor.getBoundingClientRect();
  const width = 220;
  const estimatedHeight = 118;
  let left = Math.max(8, rect.left);
  if (left + width > view.innerWidth - 8) {
    left = Math.max(8, view.innerWidth - width - 8);
  }
  let top = rect.bottom + 6;
  if (top + estimatedHeight > view.innerHeight - 8 && rect.top > estimatedHeight + 8) {
    top = rect.top - estimatedHeight - 6;
  }
  card.style.left = `${Math.round(left)}px`;
  card.style.top = `${Math.round(top)}px`;
}

export function createAutofillUi(doc: Document): AutofillUi {
  const host = ensureHost(doc);
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${SHADOW_CSS}</style><div class="c-root"></div>`;
  const root = shadow.querySelector('.c-root') as HTMLElement;
  let chip: HTMLElement | null = null;
  let review: HTMLElement | null = null;
  let reviewStamp = '';
  let card: HTMLElement | null = null;
  let positionedOn: Element | null = null;

  const reposition = () => {
    if (!card || !positionedOn || !card.isConnected) return;
    const view = doc.defaultView;
    if (!view) return;
    positionFieldCard(card, positionedOn, view);
  };

  const view = doc.defaultView;
  view?.addEventListener('scroll', reposition, true);
  view?.addEventListener('resize', reposition);

  return {
    host,
    shadow,
    showPageChip({ authorCount, busy, error, onFillAll }) {
      if (!chip) {
        chip = doc.createElement('div');
        chip.className = 'c-chip';
        chip.setAttribute(PAGE_CHIP_ATTR, 'true');
        chip.setAttribute('role', 'status');
        root.appendChild(chip);
      }
      chip.replaceChildren();
      const mark = doc.createElement('span');
      mark.className = 'c-mark';
      mark.textContent = 'C';
      mark.setAttribute('aria-hidden', 'true');
      const copy = doc.createElement('span');
      copy.className = 'c-copy';
      copy.textContent = error ?? fillAllLabel(authorCount);
      if (error) copy.classList.add('c-error');
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'c-btn';
      button.textContent = busy ? 'Filling…' : 'Fill authors';
      button.disabled = Boolean(busy);
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!button.disabled) onFillAll();
      });
      chip.append(mark, copy, button);
    },
    hidePageChip() {
      chip?.remove();
      chip = null;
    },
    showReviewNotice({ messages, onDismiss }) {
      // DOM refreshes must not collapse the details the scientist is reading.
      const stamp = JSON.stringify(messages);
      if (review && stamp === reviewStamp) return;
      review?.remove();
      reviewStamp = stamp;
      review = doc.createElement('div');
      review.className = 'c-chip c-review';
      review.setAttribute(REVIEW_NOTICE_ATTR, 'true');
      const mark = doc.createElement('span');
      mark.className = 'c-mark';
      mark.textContent = 'C';
      mark.setAttribute('aria-hidden', 'true');
      const copy = doc.createElement('div');
      copy.className = 'c-copy';
      const heading = doc.createElement('strong');
      heading.textContent = 'Corresponding: review author details';
      heading.setAttribute('role', 'status');
      const explanation = doc.createElement('div');
      explanation.textContent = 'Check the journal fields before continuing.';
      const details = doc.createElement('details');
      const summary = doc.createElement('summary');
      summary.textContent = `Details (${messages.length})`;
      const list = doc.createElement('ul');
      for (const message of messages) {
        const item = doc.createElement('li');
        item.textContent = message;
        list.appendChild(item);
      }
      details.append(summary, list);
      copy.append(heading, explanation, details);
      const dismiss = doc.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'c-btn c-btn-ghost';
      dismiss.textContent = 'Dismiss';
      dismiss.setAttribute('aria-label', 'Dismiss Corresponding review notice');
      dismiss.addEventListener('click', (event) => {
        event.stopPropagation();
        onDismiss();
      });
      review.append(mark, copy, dismiss);
      root.appendChild(review);
    },
    hideReviewNotice() {
      review?.remove();
      review = null;
      reviewStamp = '';
    },
    showFieldCard({ author, anchor, busy, error, onFillOne }) {
      if (!card) {
        card = doc.createElement('div');
        card.className = 'c-card';
        card.setAttribute(FIELD_CARD_ATTR, 'true');
        card.setAttribute('role', 'group');
        card.setAttribute('aria-label', 'Corresponding autofill');
        root.appendChild(card);
      }
      const preview = authorPreview(author);
      card.replaceChildren();
      const kicker = doc.createElement('div');
      kicker.className = 'c-kicker';
      kicker.textContent = 'Fill with Corresponding';
      const name = doc.createElement('div');
      name.className = 'c-name';
      name.textContent = preview.name;
      const institution = doc.createElement('div');
      institution.className = 'c-meta';
      institution.textContent = preview.institution;
      const email = doc.createElement('div');
      email.className = 'c-meta';
      email.textContent = preview.email;
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'c-btn';
      button.style.marginTop = '6px';
      button.textContent = busy ? 'Filling…' : 'Fill author';
      button.disabled = Boolean(busy);
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!button.disabled) onFillOne();
      });
      card.append(kicker, name);
      if (preview.institution) card.append(institution);
      if (preview.email) card.append(email);
      if (error) {
        const err = doc.createElement('div');
        err.className = 'c-meta c-error';
        err.textContent = error;
        card.append(err);
      }
      card.append(button);
      positionedOn = anchor;
      const win = doc.defaultView;
      if (win) positionFieldCard(card, anchor, win);
    },
    hideFieldCard() {
      card?.remove();
      card = null;
      positionedOn = null;
    },
    destroy() {
      view?.removeEventListener('scroll', reposition, true);
      view?.removeEventListener('resize', reposition);
      host.remove();
    },
  };
}
