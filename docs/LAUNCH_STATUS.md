# Launch status — September 13, 2026

This is a readiness checklist, **not a declaration that the repository or site
is public**. No Show HN post, social announcement, or visibility change has been
made. Status meanings: Verified = observed; Ready = prepared but not externally
completed; Blocked = a concrete dependency; Pending user action = owner decision.

## Checklist follow-up

[Launch-day runbook](LAUNCH_DAY.md) and [store handoff](STORE_HANDOFF.md) now
cover the Show HN sequence, acceptance script, support triage, rollback, package
and reviewer instructions. The local homepage includes the refreshed MP4, sample
CSV download, six-author practice roster, review caveats and email support.
The public site remains unavailable. No announcement has been sent.

Current anonymous recheck: corresponding.app cannot resolve; GitHub returns 404.
Authenticated recheck: repository PRIVATE, release list empty. Main CI run
34736029284 succeeded; launch PR #71 run 34737804748 was pending at inspection.
These are distinct from local verification of the changes in this follow-up.

## Public-release gate

- **Verified:** latest remote `main` at the start of this review was `a8cb898`;
  the user's README edits and support email are preserved.
- **Verified:** GitHub repository is PRIVATE. No releases/download packages are
  published. The README accurately describes the current build-and-load install.
- **Blocked:** public DNS for `corresponding.app` returns NXDOMAIN (Google public
  DNS and direct HTTPS resolution checks). No public website is verified.
- **Pending user action:** historical media privacy review below must be resolved
  before calling this repository ready to make public.
- **Ready:** GitHub Settings → General → Danger Zone → Change visibility shows
  **Change to public**. The option was inspected but not selected. After the
  privacy gate is cleared, the owner must review GitHub's warnings and perform
  the final confirmation. Do not treat this checklist as permission to click it.
  [Repository settings](https://github.com/kylekimler/Corresponding/settings).

## Show HN rehearsal instance

- **Verified:** actual production web build running locally at
  **http://127.0.0.1:4173/**; workspace at `/#/manuscript`. This works only on
  this computer while the preview process runs. It is not a public submission URL.
- **Verified:** browser-created synthetic two-author roster survives a refresh
  in the in-app browser. No real roster or portal draft was changed.
- **Verified:** port 4173 (both localhost and 127.0.0.1) is explicitly allowed by
  discovery, manifest, and background origin validation. No trust expansion.
- **Verified:** isolated Chromium journeys on both exact origins save to the
  built extension, persist edits, and offer click-to-fill on synthetic fixtures.
  This is not a live production-domain or new live publisher verification.
- **Ready:** reproducible start and Chrome load instructions are in
  [WEB_APP.md](WEB_APP.md#local-launch-rehearsal). Use Chrome with the extension
  for synchronization; a browser without the extension demonstrates editing only.
- **Blocked:** shareable staging requires the intended Netlify account. Native
  Chrome at `https://app.netlify.com/` shows Log in; that page is left available.
  No new account, paid commitment, or GitHub app authorization was made.
- **Ready:** existing Netlify configuration builds `npm run build:web` from the
  root, publishes only `web/dist`, and uses Node 22. No required environment
  variables. Public GitHub is not required to deploy an authorized private repo.
- **Pending user action:** identify/sign into the intended hosting account and
  identify the domain registrar/owner. No domain purchase is authorized.
- **Blocked:** a generated Netlify staging URL is editor-only; extension sync
  requires `https://corresponding.app` or the approved local preview. Production
  DNS/TLS and an actual production handshake remain unverified.

## Source, history, and media review

- **Verified:** Gitleaks 8.30.1, `gitleaks git . --log-opts="--all" --redact=100`,
  reports zero credential findings (166 scanned nonempty commits; 229 reachable
  commits at the initial audit). Exported tracked files plus recovered historical
  media also produce zero findings. This is not proof of absence of all secrets
  or private data; scanners do not certify pixels, spoken audio, or GitHub logs.
- **Verified:** tracked credential-shaped filenames contain only `.env.example`;
  no tracked live environment file, private key, database, profile, or current raw
  `.mov`. The tracked sample CSV is synthetic. Optional credentials stay unset.
- **Pending user action — publication blocker:** commit `5338bb6` retains
  `docs/media/{medrxiv,plos-one,scholarone}.mov` and corresponding `.png` files,
  despite their removal from the current tree in `0b55dfa`. Visual review of
  those screenshots confirms account labels and a private draft identifier.
  Current older GIFs (`medrxiv.gif`, `plos-one.gif`, `scholarone.gif`) also need
  full privacy review. Raw video audio/all frames are not certified safe.
  Do not publish sensitive values in issues or this checklist.
- **Pending user action:** decide whether the historical content is acceptable
  to expose, or authorize a scoped cleanup/history-rewrite plan. A new deletion
  commit cannot remove past copies. No history or media was deleted in this work.
- **Ready:** newer ScholarOne/PLOS Genetics/bioRxiv media retain their previously
  verified redactions and linked caveats. Their GIF/MP4 format and size checks
  remain automated. Old history is a separate exposure surface.
- **Pending user action:** review GitHub issue/PR discussions, attachments,
  Actions logs, commit-author identities, and older media before public exposure;
  the local repository scan does not cover all GitHub-hosted content.
- **Pending user action:** current autofill test fixtures also use the owner's
  professional contact address. Review that intentional contact exposure along
  with commit identities; the credential scanner does not classify emails as secrets.

## Documentation and install path

- **Verified:** MIT license, support email, supported-platform labels, manual
  review instructions, local persistence and count-only disclosure exist. Reuse
  the README and linked privacy/recording notes rather than duplicate them.
- **Ready:** privacy-policy contact placeholder replaced with the approved support
  email; policy remains explicitly draft pending owner/store review.
- **Ready:** [WEB_APP.md](WEB_APP.md#netlify-handoff) provides root build/output,
  no-secret environment setup, staging restrictions, canonical apex/DNS/TLS,
  and the post-deploy verification route.
- **Blocked:** anonymous clone/download and GitHub-hosted docs/demo access remain
  unavailable while private. Do not claim a fresh anonymous install passed.
- **Pending:** Chrome Web Store publication and its final install URL. No store listing or public release asset was created. A local ZIP and website
  sample-roster trial are prepared; a public practice author form is not included.
- **Pending:** broader live portal checks; Nature remains experimental. Known
  CSV apostrophe round-trip edge case and bioRxiv transient lookup warnings
  remain in [BACKLOG.md](BACKLOG.md); a launch preview does not resolve them.

## Latest checklist verification

411 tests, typecheck, security lint, both builds, ZIP and ten isolated Chromium
journeys pass. The no-extension trial covers MP4 seek, CSV download, sample
editing and reload persistence; mobile layout was visually reviewed.
Package and screenshot candidates are in `.output/` and `.output/launch/`.
The new popup guard refuses sample Fill outside local fixtures. No new browser
permissions. These checks do not certify a public manual Chrome installation.

## Verification record

September 13 local verification: 405 tests, nine isolated Chromium journeys,
typecheck, security lint, extension build, web build, and diff whitespace check
pass. A clean source export with no live environment file passed `npm ci` and
both builds; this does not claim an anonymous clone or manual Chrome install.

`npm audit --omit=dev` reports zero production vulnerabilities. Full `npm audit`
reports ten development-tool vulnerabilities (six high, four moderate), involving
Vitest/mocker, WXT/web-ext/addons-linter/image-size, fast-uri, js-yaml and adm-zip.
No forced upgrades or downgrades were applied. Keep developer servers loopback-only;
review compatible toolchain updates separately before exposing development tools
or treating the whole dependency tree as clean. Only static output is deployable.

Build, origin/handshake and fresh-dependency checks are recorded in DEVLOG. Public
deployment and anonymous installation cannot be marked verified until their
external gates are cleared. Recheck this document after any new commit.

Before public confirmation, read [GitHub visibility implications](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility):
repository content, relevant history and Actions logs become public, and others
can fork it. The current state is **prepared for review, not cleared to publish**.
