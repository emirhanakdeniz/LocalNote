import { invoke } from "@tauri-apps/api/core";
import type { DocumentRecord } from "./types";

export const documentApi = {
  load: (pageId: string) =>
    invoke<DocumentRecord>("load_document", { pageId }),
  save: (pageId: string, contentJson: string) =>
    invoke<DocumentRecord>("save_document", { pageId, contentJson }),
};
