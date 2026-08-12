/**
 * DOM chaos / fuzz harness for adapters and generic recognition.
 * Prefer false negatives over false positives.
 */

export type ChaosOp =
  | 'wrap_fields'
  | 'insert_unrelated'
  | 'insert_hidden'
  | 'reorder_in_parent'
  | 'change_classes'
  | 'add_help_text'
  | 'duplicate_label'
  | 'disable_optional'
  | 'shuffle_country_options'
  | 'add_empty_author_block'
  | 'add_linked_author'
  | 'move_buttons';

export interface ChaosResult {
  ops: ChaosOp[];
  htmlBeforeLength: number;
  htmlAfterLength: number;
}

function rand<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function applyChaos(
  doc: Document,
  options: { seed: number; ops: number },
): ChaosResult {
  const rng = mulberry32(options.seed);
  const applied: ChaosOp[] = [];
  const htmlBeforeLength = doc.body.innerHTML.length;
  const catalog: ChaosOp[] = [
    'wrap_fields',
    'insert_unrelated',
    'insert_hidden',
    'reorder_in_parent',
    'change_classes',
    'add_help_text',
    'duplicate_label',
    'disable_optional',
    'shuffle_country_options',
    'add_empty_author_block',
    'add_linked_author',
    'move_buttons',
  ];

  for (let i = 0; i < options.ops; i += 1) {
    const op = rand(catalog, rng);
    applied.push(op);
    switch (op) {
      case 'wrap_fields': {
        const inputs = [...doc.querySelectorAll('input, select')].slice(0, 20);
        const el = rand(inputs, rng) as Element | undefined;
        if (!el?.parentElement) break;
        const wrap = doc.createElement('div');
        wrap.className = 'chaos-wrap';
        el.parentElement.insertBefore(wrap, el);
        wrap.appendChild(el);
        break;
      }
      case 'insert_unrelated': {
        const junk = doc.createElement('input');
        junk.name = `unrelated_${Math.floor(rng() * 1e6)}`;
        junk.placeholder = 'Search site';
        doc.body.prepend(junk);
        break;
      }
      case 'insert_hidden': {
        const h = doc.createElement('input');
        h.type = 'hidden';
        h.name = 'csrf_token';
        h.value = 'SHOULD_NEVER_BE_READ_AS_PII_SIGNAL';
        doc.body.appendChild(h);
        break;
      }
      case 'reorder_in_parent': {
        const parent = doc.querySelector('fieldset, form, div');
        if (!parent || parent.children.length < 2) break;
        const a = parent.children[0]!;
        const b = parent.children[parent.children.length - 1]!;
        parent.insertBefore(b, a);
        break;
      }
      case 'change_classes': {
        const el = rand([...doc.querySelectorAll('[id]')], rng) as
          | Element
          | undefined;
        el?.classList.add(`noise-${Math.floor(rng() * 1000)}`);
        break;
      }
      case 'add_help_text': {
        const el = rand([...doc.querySelectorAll('input')], rng) as
          | Element
          | undefined;
        if (!el?.parentElement) break;
        const help = doc.createElement('small');
        help.textContent = 'Helpful tip unrelated to mapping';
        el.parentElement.insertBefore(help, el.nextSibling);
        break;
      }
      case 'duplicate_label': {
        const label = doc.querySelector('label');
        if (!label?.parentElement) break;
        const clone = label.cloneNode(true);
        label.parentElement.insertBefore(clone, label);
        break;
      }
      case 'disable_optional': {
        const middle = doc.querySelector('[id*="middle"]') as HTMLInputElement | null;
        if (middle) middle.disabled = true;
        break;
      }
      case 'shuffle_country_options': {
        const select = doc.querySelector('select[id*="country"]') as HTMLSelectElement | null;
        if (!select || select.options.length < 2) break;
        const opts = [...select.options];
        opts.sort(() => rng() - 0.5);
        select.innerHTML = '';
        for (const o of opts) select.appendChild(o);
        break;
      }
      case 'add_empty_author_block': {
        const n = doc.querySelectorAll('[id*="contrib_auth_"]').length + 100;
        const fs = doc.createElement('fieldset');
        fs.innerHTML = `
          <input id="contrib_auth_${n}_first_nm" />
          <input id="contrib_auth_${n}_last_nm" />
          <input id="contrib_auth_${n}_email" />
        `;
        doc.body.appendChild(fs);
        break;
      }
      case 'add_linked_author': {
        const pid = doc.querySelector(
          '[id*="author_pid"]',
        ) as HTMLInputElement | null;
        if (pid) pid.value = `CHAOS-PID-${Math.floor(rng() * 9999)}`;
        const email = doc.querySelector(
          '[id$="_email"]',
        ) as HTMLInputElement | null;
        const first = doc.querySelector(
          '[id$="_first_nm"]',
        ) as HTMLInputElement | null;
        const last = doc.querySelector(
          '[id$="_last_nm"]',
        ) as HTMLInputElement | null;
        if (email) email.value = 'linked-chaos@example.org';
        if (first) first.value = 'Linked';
        if (last) last.value = 'Chaos';
        break;
      }
      case 'move_buttons': {
        const btn = doc.querySelector('button');
        if (btn) doc.body.appendChild(btn);
        break;
      }
    }
  }

  return {
    ops: applied,
    htmlBeforeLength,
    htmlAfterLength: doc.body.innerHTML.length,
  };
}
