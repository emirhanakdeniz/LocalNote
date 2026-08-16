import { invoke } from "@tauri-apps/api/core";

export type ThemePreference = "system" | "light" | "dark";

export const themeApi = {
  get: () => invoke<ThemePreference>("get_theme"),
  set: (preference: ThemePreference) =>
    invoke<ThemePreference>("set_theme", { preference }),
  getAccentColor: () => invoke<string>("get_accent_color"),
  setAccentColor: (hex: string) => invoke<string>("set_accent_color", { hex }),
};
