/**
 * Which typing engine a language gets, and the choices a writer can make about it.
 *
 *   Hindi    the full engine with its word list (setup.js)
 *   English  none: Latin letters are typed as they are
 *   others   a ScriptEngine: the same rules, no word list, written in the language's script
 *
 * A few languages are written in more than one script (Sindhi, Kashmiri, Santali, Meitei). The
 * script the writer last chose for each is remembered on this device.
 */
import { LANGUAGES, getLanguage } from '../languages/registry.js';
import { engine as hindiEngine, loadLexicon } from './setup.js';
import { ScriptEngine } from './scriptEngine.js';

const SCRIPT_KEY = 'lekhani_typing_script_';
const STORE_KEY = 'lekhani_typing_v1_';

const engines = new Map();

function storageFor(language, script) {
  const key = `${STORE_KEY}${language}_${script}`;
  return {
    load: () => {
      try {
        return JSON.parse(localStorage.getItem(key) || 'null');
      } catch (error) {
        return null;
      }
    },
    save: (data) => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (error) {
        // storage blocked or full: what was learned lasts for this visit only
      }
    },
  };
}

/** 'lexicon' (Hindi), 'rules' (the others) or 'none' (English: nothing to convert). */
export function typingKind(language) {
  if (language === 'hi') return 'lexicon';
  if (language === 'en') return 'none';
  return LANGUAGES.some((l) => l.code === language) ? 'rules' : 'lexicon';
}

/** The scripts a writer can type this language in; the first is the usual one. */
export function typingScripts(language) {
  const scripts = getLanguage(language).scripts;
  return typingKind(language) === 'rules' ? scripts : [scripts[0]];
}

export function chosenScript(language) {
  const scripts = typingScripts(language);
  try {
    const saved = localStorage.getItem(SCRIPT_KEY + language);
    if (saved && scripts.includes(saved)) return saved;
  } catch (error) {
    // storage blocked: the usual script
  }
  return scripts[0];
}

export function chooseScript(language, script) {
  try {
    localStorage.setItem(SCRIPT_KEY + language, script);
  } catch (error) {
    // the choice lasts for this visit only
  }
}

/** The engine for this language (and script, when it has a choice). Hindi is always the shared one. */
export function engineFor(language, script) {
  if (typingKind(language) === 'lexicon') return hindiEngine;
  if (typingKind(language) === 'none') return null;
  const chosen = script || chosenScript(language);
  const key = `${language}|${chosen}`;
  if (!engines.has(key)) engines.set(key, new ScriptEngine(language, chosen, storageFor(language, chosen)));
  return engines.get(key);
}

/** Fetch whatever the engine needs before it is useful (only Hindi has a word list). */
export function prepareTyping(language) {
  return typingKind(language) === 'lexicon' ? loadLexicon() : Promise.resolve();
}

/** The sentence end a double space writes in this language. */
export function sentenceStop(language) {
  return getLanguage(language).stop;
}
