# Public platform research (planning only)

**Rule:** Do not implement selectors from screenshots, tutorials, or guesses. Real anonymized fixtures required before adapter work.

Research date: 2026-08-12. Based on public documentation and vendor marketing pages — not authenticated portal access.

## bioRxiv / medRxiv

- **Current status:** Priority platform; no adapter yet.
- **Observed workflow evidence needed:** A redacted compatibility capture of
  the author-entry page with its repeated author dialog closed, plus a second
  capture with one empty dialog open.
- **Likely interaction shape:** Repeated, user-opened author dialogs require a
  deterministic one-author-at-a-time state machine. This is an architectural
  observation only; selectors and button behavior must come from the captures.
- **Safety:** Never save an incomplete author merely to capture the page. Never
  touch manuscript submission, certification, license, or payment controls.

## ScholarOne Manuscripts (Clarivate)

- **Terminology:** Manuscript Central, ScholarOne Manuscripts, center sites often `*.manuscriptcentral.com`.
- **Host patterns (publicly known):** `manuscriptcentral.com` and publisher-specific subdomains.
- **Public APIs:** Clarivate documents publisher/integrations at a business level; no public browser-form selector documentation suitable for autofill.
- **Integration opportunities:** Future adapter after diagnostic capture; possible institutional SSO considerations (must never touch auth tokens).
- **Notes for Corresponding:** Expect multi-step author entry; linked author accounts likely. Capture with Diagnostics on the author step only.

## Editorial Manager (Aries / Elsevier ecosystem)

- **Terminology:** Editorial Manager (EM), often branded per journal.
- **Host patterns:** Commonly `*.editorialmanager.com` (publicly referenced in journal instructions).
- **Public APIs:** Aries/EM publish system overviews for publishers; no stable public DOM contract for third-party extensions.
- **Integration opportunities:** Adapter after redacted fixture; careful with corresponding-author and affiliation widgets.
- **Notes:** Do not scrape reviewer or decision pages.

## eJournalPress

- **Terminology:** eJournalPress (eJP); used by multiple publishers including some Nature-family workflows historically observed in this repo’s Nature MTS notes.
- **Host patterns:** Publisher-specific; often custom domains fronting eJP.
- **Public APIs:** Limited public developer docs for form DOM.
- **Integration opportunities:** Generic eJournalPress stub already registered; Nature MTS is the first concrete eJP-family adapter based on observed IDs.
- **Notes:** Numeric `contrib_auth_{n}_*` patterns may generalize — still require fixtures per variant.

## Springer Nature submission systems

- **Terminology:** Snapp / Springer Nature Article Processing Platform (public branding), plus legacy systems; Nature titles may still reference MTS/eJP depending on journal.
- **Host patterns:** Mixed — Nature MTS domains and Springer Nature submission portals appear in author instructions.
- **Public APIs:** Publisher integration programs exist; not a substitute for DOM fixtures.
- **Integration opportunities:** Keep Nature MTS adapter scoped; treat Snapp as a separate platform family until fixtures exist.
- **Notes:** Product messaging should say “tested portal” not “all Springer Nature journals.”

## Likely Corresponding integration strategy

1. Diagnostics capture on author-entry step only.
2. Corpus fixture + replay metrics.
3. Adapter contract suite opt-in.
4. Exact selectors first; semantic recognizer as assistive Preview only until confidence ≥ fill threshold.
