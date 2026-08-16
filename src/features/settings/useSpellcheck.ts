import { useCallback, useEffect, useState } from "react";
import { spellcheckApi, type SpellcheckPreference } from "./api";

export function useSpellcheck() {
  const [preference, setPreference] = useState<SpellcheckPreference>("system");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void spellcheckApi.get().then(
      (stored) => {
        if (active) setPreference(stored);
      },
      () => {
        if (active) setError("Spellcheck preference could not be loaded.");
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const setSpellcheck = useCallback(async (next: SpellcheckPreference) => {
    const previous = preference;
    setPreference(next);
    setError(null);
    try {
      await spellcheckApi.set(next);
    } catch {
      setPreference(previous);
      setError("Spellcheck preference could not be saved.");
    }
  }, [preference]);

  return { preference, error, setSpellcheck };
}
