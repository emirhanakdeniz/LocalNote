import { invoke } from "@tauri-apps/api/core";
import type { Page } from "./types";

export const pageApi = {
  list: () => invoke<Page[]>("list_pages"),
  create: (parentId: string | null) =>
    invoke<Page>("create_page", { parentId }),
  rename: (id: string, title: string) =>
    invoke<Page>("rename_page", { id, title }),
  move: (id: string, parentId: string | null, position: number) =>
    invoke<Page[]>("move_page", { id, parentId, position }),
  delete: (id: string) => invoke<Page[]>("delete_page", { id }),
  open: (id: string) => invoke<Page>("open_page", { id }),
  setFavorite: (id: string, isFavorite: boolean) =>
    invoke<Page>("set_page_favorite", { id, isFavorite }),
};
