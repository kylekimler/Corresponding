# Release Checklist

Current owner-facing launch gates and rehearsal URL:
[Launch status — September 13](LAUNCH_STATUS.md). “Ready” there does not mean
published; stop before the final GitHub visibility confirmation.

Launch-day execution: [LAUNCH_DAY.md](LAUNCH_DAY.md).
Store/download packet: [STORE_HANDOFF.md](STORE_HANDOFF.md).

## Versioning

- Follow semver: `MAJOR.MINOR.PATCH`
- Extension `manifest.version` and `package.json` version stay in lockstep
- `Roster.schemaVersion` increments only on breaking local storage shape changes; ship a migration in `src/roster/storage.ts`

## Pre-release

- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` produces `.output/chrome-mv3`
- [ ] Manually verify Nature MTS fixture flow: import → preview → fill → validate
- [ ] Confirm permissions remain `activeTab`, `storage`, `scripting` (plus documented OAuth only if Sheets enabled)
- [ ] Privacy policy draft reviewed (`docs/PRIVACY.md`)
- [ ] CWS permission text reviewed (`docs/CWS_PERMISSIONS.md`)
- [ ] Threat model skimmed for new surfaces (`docs/THREAT_MODEL.md`)
- [ ] No secrets / OAuth client secrets committed
- [ ] DEVLOG entry for the release commit
- [ ] Store screenshots show Preview/Fill and “not submitted” messaging
- [ ] LICENSE is MIT; listing and popup say free / no account / no trial

## Post-release

- [ ] Tag `vX.Y.Z`
- [ ] Monitor user diagnostic reports for new portals (do not invent selectors without fixtures)

## This week's launch and showcase recording

- [ ] Set the real Chrome Web Store install URL once the listing is available;
  the current website link honestly points to local setup instructions.
- [x] Replace the privacy contact placeholder.
- [ ] Owner review of final policy and disclosures before store publication.
- [ ] Confirm HTTPS corresponding.app can discover the published extension and
  save/select a roster. Preview-host origins are intentionally not allowed.
- [ ] Run a live author-page smoke on PLOS/Editorial Manager, ScholarOne, and
  bioRxiv/medRxiv with explicitly chosen test authors. Do not submit a manuscript.
- [ ] Record each GIF: website roster → journal author page → click Fill authors
  → inspect saved authors in order. Stop before Continue or Submit.
- [ ] Show missing requirements/review honestly; never describe fixture tests as
  live publisher validation. Nature production validation still needs a capture.
- [ ] Replace `docs/media/plos-one.gif`, `scholarone.gif`, and `medrxiv.gif` after
  reviewing recordings for real names, emails, manuscript details, and account UI.

Local verification: `npm test`, `npm run typecheck`, `npm run lint:security`,
`npm run build`, `npm run build:web`, then `npx playwright test`. Browser tests
use an isolated extension profile and synthetic publisher fixtures.
