import { invoke } from "@tauri-apps/api/core";
import type { Page } from "../pages/types";

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

export type MarkdownSource = {
  fileName: string;
  markdown: string;
};

export type ImportNotePayload = {
  title: string;
  contentJson: string;
};

export type MarkdownImportResult = {
  importedCount: number;
  pages: Page[];
  firstPageId: string | null;
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
  selectMarkdownFiles: () =>
    invoke<MarkdownSource[]>("select_markdown_files"),
  importMarkdownNotes: (notes: ImportNotePayload[]) =>
    invoke<MarkdownImportResult>("import_markdown_notes", { notes }),
};
