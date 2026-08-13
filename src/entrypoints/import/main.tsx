import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../popup/App';
import { ErrorBoundary } from '../popup/ErrorBoundary';
import '../popup/style.css';

/**
 * The same UI on a full page. Chrome closes an extension popup when a native
 * file dialog takes focus, which silently cancels file imports, so file
 * selection happens here instead.
 */
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App surface="page" />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
