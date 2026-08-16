import { invoke } from "@tauri-apps/api/core";

export type SpellcheckPreference = "system" | "off";

export const spellcheckApi = {
  get: () => invoke<SpellcheckPreference>("get_spellcheck"),
  set: (preference: SpellcheckPreference) =>
    invoke<SpellcheckPreference>("set_spellcheck", { preference }),
};
