import { invoke } from "@tauri-apps/api/core";
import type { Page } from "../pages/types";

export const trashApi = {
  list: () => invoke<Page[]>("list_trash"),
  restore: (id: string) => invoke<Page[]>("restore_page", { id }),
  deletePermanently: (id: string) =>
    invoke<Page[]>("delete_page_permanently", { id }),
  emptyTrash: () => invoke<void>("empty_trash"),
};
