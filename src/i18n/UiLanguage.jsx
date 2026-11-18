import { useEffect } from 'react';
import { getPrimary, subscribe } from '../languages/store';
import { setUiLanguage } from './index';

/** Keeps the interface in the person's preferred language: whenever it changes, the page is redrawn in it. */
const UiLanguage = () => {
  useEffect(() => {
    const apply = () => {
      setUiLanguage(getPrimary());
    };
    apply();
    return subscribe(apply);
  }, []);
  return null;
};

export default UiLanguage;
