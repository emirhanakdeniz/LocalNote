import { invoke } from "@tauri-apps/api/core";

export type MarkdownExportResult = {
  exported: boolean;
};

export type BackupNotePayload = {
  id: string;
  title: string;
  parentId: string | null;
  markdown: string;
};

export type BackupResult = {
  destinationPath: string;
  exportedCount: number;
  success: boolean;
};

export const exportApi = {
  saveMarkdown: (
    pageId: string,
    contentJson: string | null,
    markdown: string,
  ) =>
    invoke<MarkdownExportResult>("export_markdown", {
      pageId,
      contentJson,
      markdown,
    }),
  backupNotes: (notes: BackupNotePayload[]) =>
    invoke<BackupResult>("backup_notes", { notes }),
  openBackupFolder: () => invoke<void>("open_backup_folder"),
};

