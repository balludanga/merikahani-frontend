import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { observeOverlays } from './utils/accessibility';
import { initI18n } from './i18n';

// Start overlay observer to automatically manage aria-hidden for overlays/modals
if (typeof window !== 'undefined') {
  try {
    observeOverlays();
  } catch (e) {
    // ignore
  }
}

// The interface language is known before the first paint (the catalog is a small file, fetched only for
// a language other than Hindi), so nobody sees Hindi flash by first.
const render = () =>
  ReactDOM.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    document.getElementById('root')
  );
initI18n().then(render, render);