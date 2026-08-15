# Release Checklist

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
