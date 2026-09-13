# Corresponding launch-day runbook

Checked September 13, 2026. Confirmed channel: Show HN. **NO-GO until the public
try/install path passes.** This is preparation, not authorization to post.

## Gates, in order

1. **Owner: clear public-source exposure.** Resolve the historical account/draft
   media and GitHub-hosted-content review in [LAUNCH_STATUS.md](LAUNCH_STATUS.md).
   Do not make the current history public or assume deleting today's files clears it.
2. **Owner: hosting and domain.** Sign into the intended Netlify account and
   identify the domain owner. Follow [WEB_APP.md](WEB_APP.md#netlify-handoff).
   Publish only `web/dist`; verify HTTPS at the canonical corresponding.app apex.
3. **Distribution.** Publish reviewed source and a versioned extension ZIP with
   checksum, or finish Chrome Web Store review. Current installation is explicitly
   build-and-load; don't advertise one-click installation until it exists.
   Store readiness and reviewer instructions: [STORE_HANDOFF.md](STORE_HANDOFF.md).
4. **Fresh-user gate.** Complete the script below on the actual public release.
   Local automated Chromium checks are useful evidence but do not satisfy this gate.
5. **Owner: announcement.** Write HN text personally, choose a time with a few
   hours available for replies, and recheck the public links immediately before posting.

## Signed-out acceptance script

Use a new Chrome profile, no Google or journal login, no existing Corresponding
storage or extension. Record OS, Chrome version, tested commit/package version,
URL, timestamp, and pass/fail for each step. Never record private author data.

- Open the public homepage. Explain the benefit after reading it; play and seek
  the Bioinformatics video. Confirm playback on desktop and a narrow screen.
- Click **Try a sample roster**. Confirm six example authors, edit an email,
  reload, and confirm the edit survives. The sample is labelled and cannot fill
  live journal pages. This demonstrates roster preparation, not a live portal.
- Download the sample CSV. It has three synthetic authors, separate from the
  six-person interactive sample. Create a new manuscript, import it, compare
  all three names/emails/affiliations/order against the file, then reload.
- Open GitHub, README images and MP4, MIT license, privacy, supported platforms,
  and release/download signed out. Public issue reading should work; filing a
  GitHub issue needs an account, so also verify the visible email support link.
- Follow the public installation instructions exactly. If using source, use
  Node 22.13+ and the README clone → npm ci → build → Load unpacked steps.
  Record every undocumented step as a failure; do not silently repair it.
- Open the documented website origin and confirm “Saved to the Corresponding
  extension”; check the same roster in the extension popup.
- Use a local synthetic fixture for Preview → Fill → validation as described in
  the store handoff. Compare counts/order and verify the protected controls remain
  untouched. Don't use synthetic authors in real submission accounts.
- With two or three willing fresh testers, repeat without coaching. Collect
  installation blockers, unclear instructions, and successful workflow completion.
  Kyle arranges these trials; no invitations have been sent.

## Release and rollback

- Freeze a commit and run tests, typecheck, security lint, both builds, and all
  browser journeys. Verify GitHub checks on that exact revision; an older green
  main run does not certify the candidate. Record ZIP SHA-256 and version.
- Preserve the last verified ZIP, source revision, static website build and
  hosting deployment ID before replacing anything. There is no published
  known-good release yet; the first verified candidate becomes the baseline.
- For unpacked installs, retain instructions to select the previous unpacked
  directory, reload the extension, reopen tabs, and confirm sync. Back up rosters
  first. For store distribution, ship a corrected higher version through review;
  don't promise instant store rollback or a lower-version update.
- Pause promotion on wrong identity/order, unexpected overwrite, sensitive-data
  exposure, or broken installation. Preserve synthetic reproductions, repair the
  narrowest cause, rerun affected checks, and repeat the fresh-profile journey.

## Launch day and following days

- Before posting: recheck every public link and the exact distributed package;
  have the support mailbox and GitHub issues open. Link Show HN to the page with
  the easiest working trial. If gates remain open, move the date.
- Kyle writes the title, introductory comment, and replies in his own words.
  This document is a preparation checklist, not HN copy. Prepare factual notes
  on the personal problem, supported fixtures/live observations, linked-account
  protection, permissions, local data, count-only requests, and manual review.
  The edited demo is not a speed benchmark; hours saved are estimates.
- After posting: answer questions and triage reports in GitHub issues. For email
  reports, transfer a redacted summary with the reporter's consent. Track portal,
  browser/extension version, step, expected/actual outcome, severity, and status;
  never request unredacted submission HTML, cookies, tokens, or author rosters.
- Share independently on LinkedIn and existing scientific networks when ready.
  Bluesky/Mastodon and X are optional; no accounts or posts are assumed. Do not
  ask anyone to vote or comment on HN, and don't delete/repost to chase attention.
- In following days, choose a few relevant lab/RSE/open-science channels. Check
  each community's current promotion rules immediately before sharing, including
  r/bioinformatics, r/AcademicWriting, and r/GradSchool. No rule clearance or
  moderator approval is implied here. Newsletter pitches are optional later work.
- Review after 24 hours and one week: successful fresh installs, completed
  workflows, recurring failures, useful support requests. Collect counts and
  voluntary feedback; do not add author PII or tracking to measure a launch.

Sources checked September 13: [Show HN](https://news.ycombinator.com/showhn.html)
requires a usable project and encourages a low-friction trial;
[HN guidelines](https://news.ycombinator.com/newsguidelines.html) prohibit generated
or AI-edited posts and vote/comment solicitation;
[Chrome publishing](https://developer.chrome.com/docs/webstore/publish/) describes
review and deferred publishing. Review timing varies; don't promise a date.
