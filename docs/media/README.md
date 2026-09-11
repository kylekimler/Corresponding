# Demo recordings

## Website → Bioinformatics / ScholarOne

The lead [GIF](scholarone-workflow.gif) and [MP4](scholarone-workflow.mp4) are
edited from a real macOS selected-region recording on September 11, 2026.
The GIF is 960 × 640, 15 fps, approximately 27 seconds and 1.2 MB. The MP4
is a smaller, pausable alternative. Neither contains audio.

The sequence shows the local website importing a synthetic three-person
spreadsheet, confirming extension synchronization, and an explicit click on
the contextual fill control in the live Bioinformatics ScholarOne portal.
Maya Chen, Leo Rivera, and Priya Shah were added in that order after the
pre-existing submitting author. No final submission or declarations were
performed. Both portal drafts were explicitly approved as disposable test space.

### Editing and privacy

- Idle gaps and repeated dialog cycles were removed; retained footage runs
  at original speed. This is an edited walkthrough, not a timing benchmark.
- The recording excludes the browser address bar. Existing author identity
  and contact details are masked before filling; other shots are cropped to
  the author dialog or synthetic roster. Original footage remains outside Git.
- The institutional warning icons are deliberately retained. Institution
  verification and ScholarOne CRediT contribution entry remain manual steps.
- The initial PLOS Genetics attempt is **not** included: it flagged missing
  required information. The country/reporting fixes were subsequently tested
  and a new PLOS Genetics take was recorded, as described below.

### Reproduce this edit

Requires FFmpeg with libx264. The edit list and privacy masks are specific to
this 2464 × 1622 source recording, not a general-purpose redactor:

```sh
node scripts/render-scholarone-demo.mjs /absolute/path/to/original-recording.mov
```

Review the entire resulting video before publishing if the source changes;
timecodes and masks must not be reused blindly on a different recording.

## Editorial Manager / PLOS Genetics

The [GIF](plos-genetics-workflow.gif) and [edited MP4](plos-genetics-workflow.mp4)
show the September 11 live PLOS Genetics test draft after the country and review
notice fixes. Both are 960 × 640, 15 fps, approximately 8.5 seconds, without audio.
The GIF is 597 KB; the MP4 is 137 KB.

- An explicit **Fill authors** click adds Maya Chen, Leo Rivera, and Priya Shah
  in order after the existing corresponding author, who is unchanged.
- The edit retains the first author dialog and final roster; idle time and
  repeated dialog cycles are omitted. Retained footage plays at original speed.
  The MP4 has the same cuts as the GIF; neither is a timing benchmark.
- Original author identity/affiliation is masked in the roster shots, and the
  dialog shot excludes that background row. Yellow institution-verification
  icons and Corresponding's persistent review notice remain visible.
- The live recheck before recording reopened all three synthetic authors and
  confirmed the U.S. country, postal code, and assigned CRediT roles. That
  inspection is **not** in this short clip. Institutional verification remains
  manual. No manuscript continuation, final submission, or declarations were clicked.

## bioRxiv

The [GIF](biorxiv-workflow.gif) is a condensed 960 × 640, 15 fps, approximately
7.5-second highlight (481 KB): empty list and explicit **Fill authors** click, the first
author's fields, then the final three-author list. It skips the repeated dialog
cycles. Names, emails, and Broad Institute affiliations appear in roster order.

The [continuous MP4](biorxiv-workflow.mp4) is 1200 × 816, 15 fps, approximately
14 seconds (674 KB). Only idle lead/tail are removed: it includes every author-entry
cycle at original speed, including the portal's transient lookup warnings and
required-field flashes. The final list alone does **not** establish that those
intermediate warnings are harmless in every case; this deserves follow-up testing.

- Recorded September 11 in an explicitly approved disposable draft, initially
  empty. The three authors are synthetic and use `example.org` emails.
- No corresponding author was designated. **Save / Continue was not clicked**,
  so this demonstrates the author-list UI, not persistence after continuing or
  a submission-ready manuscript. No final submission occurred.
- This used an already-open portal tab. A fresh-tab rerun is still needed before
  treating the footage as verification of the latest compiled extension build.
- Account identity, private draft identifier, and personal details offered by
  native Chrome autofill are masked. Those native suggestions are not part of
  Corresponding. Gray rectangles are privacy redactions, not changes to form data.
- Both files are silent. Raw footage stays outside Git.

### Reproduce the publisher edits

Requires FFmpeg with libx264. Source-specific dimensions, durations, cuts, and
privacy masks are checked/documented in the script. Do not apply it to another
recording without reviewing every frame and updating the edit decisions.

```sh
node scripts/render-publisher-demos.mjs plos /absolute/path/to/plos-recording.mov
node scripts/render-publisher-demos.mjs biorxiv /absolute/path/to/biorxiv-recording.mov
```

An optional third argument selects an output directory. The bioRxiv render also
creates an ignored `biorxiv-highlights.mp4` intermediate used to encode the GIF;
the linked public MP4 is the continuous version. All published edits strip audio
and source metadata. Original `.mov` files are not committed.

## Earlier recordings

These remain available but show an earlier extension interface.

| File | Platform | Size |
| --- | --- | --- |
| [`plos-one.gif`](plos-one.gif) | Editorial Manager / PLOS ONE | 800px |
| [`scholarone.gif`](scholarone.gif) | ScholarOne / Bioinformatics | 600px |
| [`medrxiv.gif`](medrxiv.gif) | medRxiv | 800px |

Sources were 60 fps screen recordings, scaled and quantized with per-video palettes.
