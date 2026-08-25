import {
  ROSTER_SCHEMA_VERSION,
  type Affiliation,
  type Author,
  type Roster,
} from '@/schema/author';
import { normalizeOrcid } from '@/schema/orcid';

const SUPER_DIGITS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const ORCID_RE = /(?:https?:\/\/orcid\.org\/)?(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/i;
const AFFILIATION_LINE_RE = /^\s*(\d+)\s*[.)]?\s+(\S.*)$/;
const CORRESPONDING_NOTE_RE =
  /corresponding authors?\s*:?\s*(.+)$/i;

export interface ParsedAuthorDraft {
  givenName: string;
  middleName?: string;
  familyName: string;
  email?: string;
  orcid?: string;
  isCorresponding: boolean;
  affiliationMarkers: string[];
  affiliationText?: string;
}

export interface AuthorBlockParseResult {
  authors: ParsedAuthorDraft[];
  affiliations: Array<{ marker: string; institution: string }>;
  warnings: string[];
}

function normalizeSuperscripts(value: string): string {
  return value.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (ch) => SUPER_DIGITS[ch] ?? ch);
}

function splitLines(text: string): string[] {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');
}

function splitTopLevel(value: string, separators: RegExp): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i]!;
    if (ch === '(' || ch === '[' || ch === '<') depth += 1;
    if (ch === ')' || ch === ']' || ch === '>') depth = Math.max(0, depth - 1);
    if (depth === 0) {
      const rest = value.slice(i);
      const match = rest.match(separators);
      if (match && match.index === 0) {
        if (current.trim()) parts.push(current.trim());
        current = '';
        i += match[0]!.length - 1;
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function extractEmail(token: string): { text: string; email?: string } {
  const match = token.match(EMAIL_RE);
  if (!match) return { text: token };
  const email = match[0]!;
  return {
    email,
    text: token.replace(email, '').replace(/[<>()]/g, ' ').replace(/\s+/g, ' ').trim(),
  };
}

function extractOrcid(token: string): { text: string; orcid?: string } {
  const match = token.match(ORCID_RE);
  if (!match) return { text: token };
  return {
    orcid: normalizeOrcid(match[1] ?? match[0]),
    text: token.replace(match[0]!, '').replace(/\s+/g, ' ').trim(),
  };
}

function peelMarkers(token: string): {
  text: string;
  corresponding: boolean;
  markers: string[];
} {
  let corresponding = token.includes('*');
  let text = normalizeSuperscripts(token)
    .replace(/[*†‡§¶]/g, '')
    .replace(/[,\s;]+$/g, '')
    .trim();
  const markers: string[] = [];
  const trailing = text.match(/^(.*?)((?:\s*[,;]?\s*\d+)+)\s*$/);
  if (trailing && trailing[1]!.trim()) {
    text = trailing[1]!.trim();
    markers.push(...(trailing[2]!.match(/\d+/g) ?? []));
  }
  return { text, corresponding, markers };
}

function parsePersonName(raw: string): {
  givenName: string;
  middleName?: string;
  familyName: string;
  warning?: string;
} {
  const cleaned = raw.replace(/[.,;:]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return { givenName: 'Given', familyName: 'Family', warning: 'Empty name token' };
  }
  if (cleaned.includes(',')) {
    const [family, rest] = cleaned.split(',').map((part) => part.trim());
    const restParts = (rest ?? '').split(/\s+/).filter(Boolean);
    return {
      familyName: family || 'Family',
      givenName: restParts[0] || 'Given',
      middleName: restParts.slice(1).join(' ') || undefined,
      warning: family && restParts[0] ? undefined : 'Incomplete inverted name',
    };
  }
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return {
      givenName: parts[0]!,
      familyName: '—',
      warning: `Could not split a family name from “${parts[0]}”`,
    };
  }
  return {
    givenName: parts[0]!,
    middleName: parts.slice(1, -1).join(' ') || undefined,
    familyName: parts[parts.length - 1]!,
  };
}

function parseAuthorToken(token: string): ParsedAuthorDraft & { warning?: string } {
  const emailled = extractEmail(token);
  const orcidded = extractOrcid(emailled.text);
  let affiliationText: string | undefined;
  let body = orcidded.text;
  const paren = body.match(/\(([^)]+)\)/);
  if (paren && !EMAIL_RE.test(paren[1]!) && !ORCID_RE.test(paren[1]!)) {
    affiliationText = paren[1]!.trim();
    body = body.replace(paren[0], '').replace(/\s+/g, ' ').trim();
  }
  const peeled = peelMarkers(body);
  const name = parsePersonName(peeled.text);
  return {
    givenName: name.givenName,
    middleName: name.middleName,
    familyName: name.familyName,
    email: emailled.email,
    orcid: orcidded.orcid,
    isCorresponding: peeled.corresponding,
    affiliationMarkers: peeled.markers,
    affiliationText,
    warning: name.warning,
  };
}

function isAffiliationLine(line: string): boolean {
  return AFFILIATION_LINE_RE.test(line);
}

function isCorrespondingNote(line: string): boolean {
  return CORRESPONDING_NOTE_RE.test(line.trim());
}

/**
 * Deterministic parser for common manuscript author blocks.
 * Does not guess unrecognized names or CRediT roles.
 */
export function parseAuthorBlock(text: string): AuthorBlockParseResult {
  const warnings: string[] = [];
  const lines = splitLines(text)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { authors: [], affiliations: [], warnings: ['Nothing to parse'] };
  }

  const affiliations: Array<{ marker: string; institution: string }> = [];
  const noteLines: string[] = [];
  const authorLines: string[] = [];

  for (const line of lines) {
    if (isCorrespondingNote(line)) {
      noteLines.push(line);
      continue;
    }
    if (isAffiliationLine(line)) {
      const match = line.match(AFFILIATION_LINE_RE);
      if (match) {
        affiliations.push({
          marker: match[1]!,
          institution: match[2]!.trim(),
        });
      }
      continue;
    }
    authorLines.push(line);
  }

  const numberedMode = affiliations.length > 0;
  const onePerLine =
    !numberedMode &&
    authorLines.length >= 2 &&
    authorLines.every((line) => splitTopLevel(line, /\s*,\s*/).length <= 1);

  const tokens = (onePerLine
    ? authorLines
    : authorLines.flatMap((line) =>
        splitTopLevel(line, /\s*(?:,|;|\s+and\s+|\s+&\s+)\s*/i),
      )
  )
    .map((token) => token.replace(/^(and|&)\s+/i, '').trim())
    .filter(Boolean);

  const authors = tokens
    .map((token) => parseAuthorToken(token))
    .filter((draft) => draft.givenName !== 'Given' || draft.familyName !== 'Family');

  for (const draft of authors) {
    if (draft.warning) warnings.push(draft.warning);
  }

  if (authors.length === 0) {
    warnings.push('No author names could be read from that text');
  }

  const correspondingNames = noteLines.flatMap((line) => {
    const match = line.match(CORRESPONDING_NOTE_RE);
    return match?.[1]
      ? splitTopLevel(match[1], /\s*(?:,|;|\s+and\s+|\s+&\s+)\s*/i)
      : [];
  });
  if (correspondingNames.length > 0) {
    for (const author of authors) {
      const hay = `${author.givenName} ${author.familyName}`.toLowerCase();
      if (
        correspondingNames.some((name) =>
          hay.includes(name.toLowerCase()) ||
          name.toLowerCase().includes(author.familyName.toLowerCase()),
        )
      ) {
        author.isCorresponding = true;
      }
    }
  }

  return { authors, affiliations, warnings };
}

export function authorBlockToRoster(
  parsed: AuthorBlockParseResult,
  options: { name?: string; id?: string; now?: string } = {},
): Roster {
  const now = options.now ?? new Date().toISOString();
  const affByMarker = new Map(
    parsed.affiliations.map((aff) => [aff.marker, aff.institution]),
  );
  const authors: Author[] = parsed.authors.map((draft, index) => {
    const affiliations: Affiliation[] = [];
    if (draft.affiliationMarkers.length > 0) {
      for (const marker of draft.affiliationMarkers) {
        const institution = affByMarker.get(marker);
        if (institution) {
          affiliations.push({
            institution,
            isPrimary: affiliations.length === 0,
          });
        }
      }
    } else if (draft.affiliationText) {
      affiliations.push({
        institution: draft.affiliationText,
        isPrimary: true,
      });
    }
    return {
      id: crypto.randomUUID(),
      givenName: draft.givenName,
      middleName: draft.middleName,
      familyName: draft.familyName,
      email: draft.email,
      orcid: draft.orcid,
      isCorresponding: draft.isCorresponding,
      equalContribution: false,
      creditRoles: [],
      affiliations,
      sequence: index + 1,
    };
  });

  return {
    id: options.id ?? crypto.randomUUID(),
    name: options.name ?? 'Manuscript authors',
    authors,
    schemaVersion: ROSTER_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    source: 'web',
  };
}
