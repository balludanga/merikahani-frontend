/**
 * The browser-side wiring of the typing engine: fetching the word list when it is first needed,
 * remembering what the writer has taught it, and the one setting they can change (the list on/off).
 * Tests and scripts import engine.js directly and never touch this file.
 */
import lexiconUrl from './hindi-lexicon.txt';
import { engine } from './engine.js';
import './suggest.css';

const STORE_KEY = 'lekhani_typing_v1';
const LIST_KEY = 'lekhani_suggest';

let loading = null;
let attached = false;

function attachStorage() {
  if (attached) return;
  attached = true;
  engine.attachStorage({
    load: () => {
      try {
        return JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      } catch (error) {
        return null;
      }
    },
    save: (data) => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(data));
      } catch (error) {
        // storage blocked or full: what was learned lasts for this visit only
      }
    },
  });
}

/** Fetch the word list (once). Typing works without it, only with fewer and poorer suggestions. */
export function loadLexicon() {
  attachStorage();
  if (engine.ready()) return Promise.resolve();
  if (!loading) {
    loading = fetch(lexiconUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`lexicon ${response.status}`);
        return response.text();
      })
      .then((text) => engine.setLexiconText(text))
      .catch(() => {
        loading = null; // offline or blocked: try again the next time a field is focused
      });
  }
  return loading;
}

/** Is the candidate list shown? (Typing converts live either way.) */
export function showSuggestions() {
  try {
    return localStorage.getItem(LIST_KEY) !== 'off';
  } catch (error) {
    return true;
  }
}

export function setShowSuggestions(on) {
  try {
    localStorage.setItem(LIST_KEY, on ? 'on' : 'off');
  } catch (error) {
    // the choice lasts for this visit only
  }
}

export { engine };
