import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { observeOverlays } from './utils/accessibility';

// Start overlay observer to automatically manage aria-hidden for overlays/modals
if (typeof window !== 'undefined') {
  try {
    observeOverlays();
  } catch (e) {
    // ignore
  }
}

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);