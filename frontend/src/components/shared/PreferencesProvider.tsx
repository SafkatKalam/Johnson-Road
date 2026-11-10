import { useLayoutEffect, useState, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import {
  PreferencesContext,
  applyPreferences,
  loadPreferences,
  savePreferences,
  type Preferences,
} from '@/lib/preferences';

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);

  // Before the first paint, so there is no flash at the default size or motion.
  useLayoutEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);

  const update = (changes: Partial<Preferences>) => {
    const next = { ...preferences, ...changes };
    setPreferences(next);
    savePreferences(next);
  };

  return (
    <PreferencesContext.Provider value={{ preferences, update }}>
      {/* "user" = follow the operating system's reduce-motion setting; "always" = the in-app choice wins. */}
      <MotionConfig reducedMotion={preferences.reduceMotion ? 'always' : 'user'}>{children}</MotionConfig>
    </PreferencesContext.Provider>
  );
}
