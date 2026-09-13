import { useEffect, useState } from 'react';
import { createEmptyManuscript } from '@/schema/manuscript';
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
      <footer className="site-footer">
        <p>Because filling out grant and publication forms shouldn't be a scientist's full time job</p>
        <a href="https://github.com/kylekimler/Corresponding#supported-platforms" target="_blank" rel="noreferrer">Supported platforms</a>
        <a href="https://github.com/kylekimler/Corresponding/blob/main/docs/PRIVACY.md" target="_blank" rel="noreferrer">Privacy</a>
        <a href="https://github.com/kylekimler/Corresponding/issues" target="_blank" rel="noreferrer">Feedback</a>
      </footer>
    </main>
  );
}
