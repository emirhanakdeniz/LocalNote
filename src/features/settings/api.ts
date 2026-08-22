import { invoke } from "@tauri-apps/api/core";

export type SpellcheckPreference = "system" | "off";

export type StorageInfo = {
  dataRoot: string;
  databasePath: string;
  webviewDataPath: string;
  backupPath: string;
};

export const spellcheckApi = {
  get: () => invoke<SpellcheckPreference>("get_spellcheck"),
  set: (preference: SpellcheckPreference) =>
    invoke<SpellcheckPreference>("set_spellcheck", { preference }),
};

export const storageApi = {
  getInfo: () => invoke<StorageInfo>("get_storage_info"),
  openDataFolder: () => invoke<void>("open_data_folder"),
  openBackupFolder: () => invoke<void>("open_backup_folder"),
};
