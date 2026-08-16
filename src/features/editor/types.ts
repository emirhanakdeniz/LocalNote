import type { PartialBlock } from "@blocknote/core";

export type DocumentRecord = {
  pageId: string;
  contentJson: string | null;
  updatedAt: string | null;
};

export type LoadedDocument = {
  pageId: string;
  blocks: PartialBlock[];
  editorKey: number;
};

export type SaveStatus = "saved" | "saving" | "unsaved" | "error";
