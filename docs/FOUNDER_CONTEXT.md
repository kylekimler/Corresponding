# Founder context

## Company and purpose

**Corresponding** is the portable, permissioned identity and metadata layer for scientists. The Chrome extension is the initial distribution wedge, not the ultimate company.

The primary job is to save scientists time: maintain information once, then carry it safely across preprints, journals, grants, conferences, repositories, institutions, collaborations, and other scientific workflows.

Product principles:

> Corresponding should never ask a scientist for information it can safely already know.

> Corresponding fills. The scientist reviews and submits.

Corresponding must never automate final submission, certification, signatures, payments, copyright acceptance, legal attestations, or other consequential final actions.

## Initial wedge and coverage strategy

Make scientific submission dramatically less painful. Prioritize:

1. bioRxiv / medRxiv
2. eLife
3. Nature / eJournalPress
4. Later: ScholarOne, Editorial Manager, and other major platform families

Prefer broad, evidence-based platform-family support over one bespoke adapter per journal. Recognition should fall through in this order:

1. Exact tested selector
2. Tested platform-family structural pattern
3. Deterministic semantic recognition
4. Explicit user-confirmed mapping
5. Refusal to fill

Prefer false negatives to false positives. Never mutate low-confidence mappings automatically.

## Core experience

The first-use loop is: open submission page → select/import roster → detect portal → Preview exact effects → surface missing/uncertain data → user clicks Fill → fill safely → validate → scientist reviews and submits.

The main popup should be small, warm, calm, beautiful, legible, scientifically credible, and subtly delightful—radically better than legacy scholarly software, without generic enterprise SaaS aesthetics.

Prioritize destination, current project/roster, ready/attention/conflict counts, Preview, and Fill. Put author management, reorder/export/duplicate/delete, diagnostics, and developer details in deeper views. Never expose OAuth client IDs, API configuration, selectors, DOM fixtures, or internal diagnostics to normal users.

## Imports and canonical data

Near-term priority:

1. Paste from spreadsheet
2. CSV
3. Excel/XLSX
4. Google Sheet picker/sync

Corresponding owns the canonical structured identity/project model. Sheets, CSV, Excel, ORCID, scholarly graphs, and institutional systems are inputs—not the database.

Google integration uses normal sign-in, explicit file selection, narrow per-file authorization where practical, and read-only application behavior. Users never enter API keys or OAuth client IDs. Missing developer credentials must not block local product development.

## Identity, provenance, and evolution

The model may eventually include publication names, emails and validity, identifiers, dated affiliations, funding, grants, works, CRediT roles, disclosures, commercial relationships, teams, software, datasets, expertise, corresponding-author history, and assertion provenance.

Do not build the whole cloud identity platform now. Evolve the wedge without damaging the simple submission workflow.

Never claim verification without evidence. Preserve source, freshness, and provenance such as self-declared, collaborator-confirmed, imported CSV/Sheet, ORCID, institution, publisher, or scholarly graph.

Likely sequence:

1. **Corresponding Fill** — painless submission forms
2. **Corresponding Profile** — reusable scientific identity
3. **Corresponding Projects / Teams** — collaborators, missing-metadata requests, repeated workflows
4. **Corresponding Graph** — only after useful workflows earn fresh, high-quality data

Sequence: utility → private identity → collaborative workflow → verified network → discovery.

## Business principles

Make the first fill magical before optimizing monetization. Scientists should tell one another: “Install this before submitting your paper.”

Potential later tiers: individual profiles/projects/sync; lab directories and collaboration workflows; institutional identity and research-office workflows; eventually publisher APIs/OEM/white-label submission-ready metadata.

Do not sell raw autofill code prematurely. Build a moat from reliability, platform compatibility, structured metadata, freshness, provenance, workflow-confirmed information, contribution resolution, and interoperability.

## Engineering and autonomous work

Maximize **verified development loops completed**, not lines of code. Prefer vertical slices such as paste → preview → fill → validate over speculative frameworks.

Meaningful features follow: spec → test → implementation → adversarial test → smoke test → merge. Every iteration should leave something a human can try.

For longer runs, separate independent roles:

- **Builder** — one coherent feature
- **QA adversary** — stress roster scale, identity edge cases, malformed data, changed DOM, linked accounts, and unsupported options
- **Security/privacy reviewer** — permissions, PII, redaction, storage, network, dependencies, unintended mutation
- **UX critic** — first use, imports, Preview/Fill, attention/errors, roster management, hierarchy

Reviews must be independent, not rubber stamps. Only one agent at a time should make major changes to shared schema, adapter interfaces, or storage. Independent agents may work on adapters, fixtures, tests, docs, visual components, and security review.

External dependencies (OAuth credentials, accounts, authenticated portals, real fixtures) are not reasons to stop. Document the blocker, then continue with independent UX, imports, schemas, fuzzing, fixtures, or reliability work.

Reports should emphasize capabilities, regressions found/fixed, tests, manual flows, blockers, and highest-value next work—not commit or line counts.

## Current focus

High value now: effortless local testing; clear Preview; compact popup; paste/CSV/XLSX; roster/project management; safe recognition; adapter reliability; bioRxiv/medRxiv and eLife investigation/fixtures; real Nature/eJournalPress validation; property/DOM-chaos tests; safe compatibility capture; excellent failures.

Explicitly defer: public scientist search, cloud graph databases, recruitment marketplace, elaborate billing, publisher enterprise APIs, speculative AI, and generalized architecture without an immediate workflow.
