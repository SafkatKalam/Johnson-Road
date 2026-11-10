import { createContext, useContext } from 'react';

// Preferences that belong to THIS browser (not to the account): they are stored on the device, work before
// sign-in, and need no server. Settings that would have to follow the person across devices are not offered yet.
export type FontSize = 'small' | 'medium' | 'large';

export interface Preferences {
  /** true = always reduce motion; false = follow the operating system's "reduce motion" setting. */
  reduceMotion: boolean;
  fontSize: FontSize;
}

export const DEFAULT_PREFERENCES: Preferences = { reduceMotion: false, fontSize: 'medium' };

const KEY = 'jr-preferences';

export function loadPreferences(): Preferences {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Preferences> | null;
    return {
      reduceMotion: raw?.reduceMotion === true,
      fontSize: raw?.fontSize === 'small' || raw?.fontSize === 'large' ? raw.fontSize : 'medium',
    };
  } catch {
    return DEFAULT_PREFERENCES; // storage blocked or the value is not valid: use the defaults
  }
}

export function savePreferences(preferences: Preferences): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(preferences));
  } catch {
    /* storage can be blocked; the choice then lasts until the page is closed */
  }
}

/** Put the choices on the page: CSS reads these two attributes (see index.css). */
export function applyPreferences(preferences: Preferences): void {
  const root = document.documentElement;
  root.dataset.reduceMotion = String(preferences.reduceMotion);
  root.dataset.fontSize = preferences.fontSize;
}

interface PreferencesContextType {
  preferences: Preferences;
  update(changes: Partial<Preferences>): void;
}

export const PreferencesContext = createContext<PreferencesContextType>({
  preferences: DEFAULT_PREFERENCES,
  update: () => undefined,
});

export function usePreferences() {
  return useContext(PreferencesContext);
}
