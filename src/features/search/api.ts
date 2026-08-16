import { invoke } from "@tauri-apps/api/core";

export type SearchResult = {
  pageId: string;
  title: string;
  snippet: string;
};

export const searchApi = {
  search: (query: string) => invoke<SearchResult[]>("search_pages", { query }),
};
