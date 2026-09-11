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
- The recorded PLOS Genetics attempt is **not** included: it saved the three
  coauthors but flagged missing required information. This needs investigation
  before using that take as a launch demonstration.

### Reproduce this edit

Requires FFmpeg with libx264. The edit list and privacy masks are specific to
this 2464 × 1622 source recording, not a general-purpose redactor:

```sh
node scripts/render-scholarone-demo.mjs /absolute/path/to/original-recording.mov
```

Review the entire resulting video before publishing if the source changes;
timecodes and masks must not be reused blindly on a different recording.

## Earlier recordings

These remain available but show an earlier extension interface.

| File | Platform | Size |
| --- | --- | --- |
| [`plos-one.gif`](plos-one.gif) | Editorial Manager / PLOS ONE | 800px |
| [`scholarone.gif`](scholarone.gif) | ScholarOne / Bioinformatics | 600px |
| [`medrxiv.gif`](medrxiv.gif) | medRxiv | 800px |

Sources were 60 fps screen recordings, scaled and quantized with per-video palettes.
