import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersAPI } from '../services/api';
import { getChoice, getPrimary, setChoice, setPrimary, subscribe } from './store';
import { cleanCodes } from './registry';

const snapshot = () => ({ read: getChoice('read'), write: getChoice('write'), primary: getPrimary() });

/**
 * The languages this person reads and writes in, and how to change them.
 *   const { read, write, primary, setRead, setWrite, setMainLanguage } = useLanguages();
 * Changes are kept on this device at once and, for someone signed in, saved to their account.
 */
export function useLanguages() {
  const { isAuthenticated, updateUser } = useAuth();
  const [state, setState] = useState(snapshot);
  useEffect(() => subscribe(() => setState(snapshot())), []);

  const save = useCallback(
    (kind, codes) => {
      const clean = setChoice(kind, codes);
      if (isAuthenticated) {
        const field = `${kind}_languages`;
        usersAPI
          .updateProfile({ [field]: clean })
          .then(() => updateUser({ [field]: clean, ...(kind === 'read' ? { primary_language: getPrimary() } : null) }))
          .catch(() => {
            // the choice still holds on this device; it is sent again the next time they sign in
          });
      }
      return clean;
    },
    [isAuthenticated, updateUser]
  );

  // The preferred language: the interface, the first stories in the feed, the start of a new story.
  const saveMain = useCallback(
    (code) => {
      const clean = setPrimary(code);
      const reading = getChoice('read');
      if (isAuthenticated) {
        usersAPI
          .updateProfile({ primary_language: clean || '', read_languages: reading })
          .then(() => updateUser({ primary_language: clean, read_languages: reading }))
          .catch(() => {
            // kept on this device; sent again the next time they sign in
          });
      }
      return clean;
    },
    [isAuthenticated, updateUser]
  );

  // The reading languages and the preferred one, chosen together in the picker.
  const saveReading = useCallback(
    (codes, main) => {
      const clean = setChoice('read', codes);
      const chosen = setPrimary(main && (clean.length === 0 || clean.includes(main)) ? main : clean[0] || null);
      const reading = getChoice('read');
      if (isAuthenticated) {
        usersAPI
          .updateProfile({ read_languages: reading, primary_language: chosen || '' })
          .then(() => updateUser({ read_languages: reading, primary_language: chosen }))
          .catch(() => {});
      }
      return { read: reading, primary: chosen };
    },
    [isAuthenticated, updateUser]
  );

  return {
    setReading: saveReading,
    read: state.read,
    write: state.write,
    primary: state.primary,
    setMainLanguage: saveMain,
    setRead: useCallback((codes) => save('read', codes), [save]),
    setWrite: useCallback((codes) => save('write', codes), [save]),
  };
}

/**
 * What every list of public stories (the feed, the stories under a story, search, a tag page) asks the
 * server for: only the languages this reader chose, their preferred one first. A reader who has chosen
 * none gets every language. `lang` and `primary` are strings, so they are safe to put in a dependency list.
 *   const { params, lang, primary, active } = useFeedLanguages();
 */
export function useFeedLanguages() {
  const { read, primary } = useLanguages();
  const lang = read.join(',');
  return useMemo(
    () => ({
      lang,
      primary: primary || '',
      active: lang.length > 0,
      params: { ...(lang ? { lang } : null), ...(primary ? { primary } : null) },
    }),
    [lang, primary]
  );
}

/**
 * Keeps the device and the account in step. On sign-in the account's lists win; a person who chose
 * languages before they signed in has them saved to the account instead, once.
 * Renders nothing; mount it once, inside the auth provider.
 */
export function LanguageSync() {
  const { user, updateUser } = useAuth();
  const pushed = useRef(null);
  useEffect(() => {
    if (!user || pushed.current === user.id) return;
    pushed.current = user.id;
    const changes = {};
    const accountMain = user.primary_language || null;
    if (accountMain) {
      if (accountMain !== getPrimary()) setPrimary(accountMain);
    } else if (getPrimary()) {
      changes.primary_language = getPrimary();
    }
    ['read', 'write'].forEach((kind) => {
      const field = `${kind}_languages`;
      const account = cleanCodes(user[field]);
      const device = getChoice(kind);
      if (account.length) {
        if (account.join() !== device.join()) setChoice(kind, account);
      } else if (device.length) {
        changes[field] = device;
      }
    });
    if (Object.keys(changes).length) {
      usersAPI
        .updateProfile(changes)
        .then(() => updateUser(changes))
        .catch(() => {});
    }
  }, [user, updateUser]);
  return null;
}
