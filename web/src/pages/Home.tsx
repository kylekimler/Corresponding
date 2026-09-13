import { useEffect, useState } from 'react';
import { createEmptyManuscript } from '@/schema/manuscript';
import { createSampleRoster } from '@/roster/sample';
import demoUrl from '../../../docs/media/scholarone-workflow.mp4?url';
import sampleTableUrl from '../../../fixtures/sample-authors.csv?url';
import { pingExtension, type BridgeResult } from '../bridge/client';
import { saveLocalManuscript } from '../storage/localManuscript';

const INSTALL_URL =
  'https://github.com/kylekimler/Corresponding#install';

export function Home({ hasDraft }: { hasDraft: boolean }) {
  const [extension, setExtension] = useState<BridgeResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void pingExtension().then(setExtension);
  }, []);

  const installed = extension?.type === 'PONG';
  const checking = extension === null;

  function trySample() {
    if (hasDraft && !window.confirm('Open a sample manuscript? Your current draft will be kept in this browser’s manuscript history.')) return;
    try {
      const manuscript = createEmptyManuscript('Sample research team');
      manuscript.roster = { ...createSampleRoster(), id: manuscript.id };
      saveLocalManuscript(manuscript);
      window.location.hash = '/manuscript';
    } catch {
      setError('This browser could not save a draft. Allow site storage and try again.');
    }
  }

  function openManuscript(create: boolean) {
    if (create && hasDraft && !window.confirm('Start a new manuscript? Your current draft will be kept in this browser’s manuscript history.')) return;
    try {
      if (create || !hasDraft) saveLocalManuscript(createEmptyManuscript());
      window.location.hash = '/manuscript';
    } catch {
      setError('This browser could not save a draft. Allow site storage and try again.');
    }
  }

  return (
    <main className="shell home">
      <nav className="home-nav" aria-label="Main navigation">
        <span className="brand"><span className="brand-mark" aria-hidden="true">C</span>Corresponding</span>
        <a href="https://github.com/kylekimler/Corresponding" target="_blank" rel="noreferrer">GitHub ↗</a>
      </nav>
      <p className="eyebrow">Less paperwork. More science.</p>
      <h1 className="home-title">Never enter your<br className="desktop-break" /> coauthors manually again.</h1>
      <p className="lede">Autofill for scientific publishing.</p>
      <p className="intro">
        Paste your manuscript authors once into the web app, then use the Chrome extension to fill supported journal submission forms.
      </p>
      <div className="actions">
        {hasDraft ? (
          <>
            <button
              type="button"
              className="primary"
              onClick={() => openManuscript(false)}
            >
              Open manuscript
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => openManuscript(true)}
            >
              Create manuscript
            </button>
          </>
        ) : (
          <button
            type="button"
            className="primary"
            onClick={() => openManuscript(true)}
          >
            Create manuscript
          </button>
        )}
      </div>
      <p><button type="button" className="secondary" onClick={trySample}>Try a sample roster</button></p>
      <p className="hint">Explore six example authors, edit their details, and reload to see local saving. No extension or journal account needed. Sample rosters cannot fill live journal pages. <a href={sampleTableUrl} download="sample-authors.csv">Download a sample author table</a> for import practice.</p>
      {error && <p role="alert" className="sync err">{error}</p>}
      <p className="trust-line">Free & open source · No account · Author data stays on your device</p>
      {installed && <p className="sync ok">Extension connected. You’re ready to prepare your authors.</p>}
      {!checking && !installed && (
        <p className="install-note">
          The Chrome extension is not connected, so journal autofill is
          unavailable. You can still prepare a roster here.{' '}
          <a href={INSTALL_URL} target="_blank" rel="noreferrer">
            Extension setup instructions
          </a>
        </p>
      )}
      <section className="how-it-works" aria-label="How it works">
        <div><span>01</span><h2>Bring your author list</h2><p>Paste from your manuscript or import a spreadsheet.</p></div>
        <div><span>02</span><h2>Make it yours</h2><p>Check names, affiliations, order, and contributions.</p></div>
        <div><span>03</span><h2>Skip the retyping</h2><p>Open your submission portal and click Corresponding to fill.</p></div>
      </section>
      <section className="launch-demo" aria-label="Bioinformatics demo">
        <h2>See the journal workflow</h2>
        <video controls playsInline preload="metadata" aria-label="Corresponding filling Bioinformatics authors" src={demoUrl} />
        <p className="hint">Edited recording of three coauthors in Bioinformatics / ScholarOne. Institutional verification and CRediT roles require manual review. Corresponding does not submit the manuscript.</p>
        <p>Capture-backed workflows: Editorial Manager (PLOS ONE/Genetics), ScholarOne (Bioinformatics), and bioRxiv/medRxiv. Journal configurations vary; Nature is experimental. bioRxiv lookup warnings remain under investigation.</p>
        <p>After filling, compare the full author count and order with your source. Review missing or skipped authors, names, emails, affiliations, corresponding status, and contributions. Correct your source and re-paste when needed; review the portal before retrying to avoid duplicates.</p>
        <p className="hint">The extension stores rosters locally. It can detect author forms on supported submission sites; filling requires your click. Other sites use access to the current tab when you open the extension. Eligible fills may send a count-only request to Corresponding; author details are never uploaded to our server.</p>
      </section>
      <footer className="site-footer">
        <p>Because filling out grant and publication forms shouldn't be a scientist's full time job</p>
        <a href="https://github.com/kylekimler/Corresponding#supported-platforms" target="_blank" rel="noreferrer">Supported platforms</a>
        <a href="https://github.com/kylekimler/Corresponding/blob/main/docs/PRIVACY.md" target="_blank" rel="noreferrer">Privacy</a>
        <a href="https://github.com/kylekimler/Corresponding/issues" target="_blank" rel="noreferrer">Feedback</a>
        <a href="mailto:corresponding.app@gmail.com">Email support</a>
      </footer>
    </main>
  );
}
