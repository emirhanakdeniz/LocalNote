import { invoke } from "@tauri-apps/api/core";

export type MarkdownExportResult = {
  exported: boolean;
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
};
