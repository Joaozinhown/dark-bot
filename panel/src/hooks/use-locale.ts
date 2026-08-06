import { useState } from 'react';
import { detectLocale, persistLocale, type SupportedLocale } from '../lib/i18n/core';

export function useLocale(): [SupportedLocale, (locale: SupportedLocale) => void] {
  const [locale, setLocale] = useState<SupportedLocale>(detectLocale);

  const changeLocale = (next: SupportedLocale) => {
    persistLocale(next);
    setLocale(next);
  };

  return [locale, changeLocale];
}
