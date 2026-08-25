import { useEffect, useState } from 'react';
import { createEmptyManuscript } from '@/schema/manuscript';
import { pingExtension, type BridgeResult } from '../bridge/client';
import { saveLocalManuscript } from '../storage/localManuscript';

const INSTALL_URL =
  'https://github.com/kylekimler/Corresponding#how-it-works';

export function Home({ hasDraft }: { hasDraft: boolean }) {
  const [extension, setExtension] = useState<BridgeResult | null>(null);

  useEffect(() => {
    void pingExtension().then(setExtension);
  }, []);

  const installed = extension?.type === 'PONG';
  const checking = extension === null;

  function openManuscript(create: boolean) {
    if (create || !hasDraft) {
      saveLocalManuscript(createEmptyManuscript());
    }
    window.location.hash = '/manuscript';
  }

  return (
    <main className="shell home">
      <h1 className="wordmark">Corresponding</h1>
      <p className="lede">Autofill for scientific publishing.</p>
      <p className="intro">
        Prepare your manuscript authors here. Corresponding will fill them into
        supported journal submission systems.
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
      {!checking && !installed && (
        <p className="install-note">
          The Chrome extension is not connected, so journal autofill is
          unavailable. You can still prepare a roster here.{' '}
          <a href={INSTALL_URL} target="_blank" rel="noreferrer">
            Install Corresponding
          </a>
        </p>
      )}
    </main>
  );
}
