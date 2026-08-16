import { useCallback, useEffect, useMemo, useState } from "react";
import { pageApi } from "./api";
import type { Page } from "./types";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function restoredActivePage(pages: Page[]): string | null {
  const opened = pages
    .filter((page) => page.lastOpenedAt)
    .sort((left, right) =>
      right.lastOpenedAt!.localeCompare(left.lastOpenedAt!),
    );
  return opened[0]?.id ?? pages[0]?.id ?? null;
}

export const RECENT_PAGE_LIMIT = 7;

export function deriveFavoritePages(pages: Page[]): Page[] {
  return pages
    .filter((page) => page.isFavorite)
    .map((page, treeIndex) => ({ page, treeIndex }))
    .sort((left, right) => {
      const recent = (right.page.lastOpenedAt ?? "").localeCompare(
        left.page.lastOpenedAt ?? "",
      );
      return recent || left.treeIndex - right.treeIndex;
    })
    .map(({ page }) => page);
}

export function deriveRecentPages(pages: Page[]): Page[] {
  return pages
    .filter((page) => page.lastOpenedAt !== null)
    .map((page, treeIndex) => ({ page, treeIndex }))
    .sort(
      (left, right) =>
        right.page.lastOpenedAt!.localeCompare(left.page.lastOpenedAt!) ||
        left.treeIndex - right.treeIndex,
    )
    .slice(0, RECENT_PAGE_LIMIT)
    .map(({ page }) => page);
}

export function usePageManagement() {
  const [pages, setPages] = useState<Page[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    pageApi
      .list()
      .then((loadedPages) => {
        if (!current) return;
        setPages(loadedPages);
        setActivePageId(restoredActivePage(loadedPages));
      })
      .catch((reason: unknown) => current && setError(errorMessage(reason)))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, []);

  const selectPage = useCallback(async (id: string) => {
    setError(null);
    try {
      const opened = await pageApi.open(id);
      setPages((current) =>
        current.map((page) => (page.id === opened.id ? opened : page)),
      );
      setActivePageId(id);
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    }
  }, []);

  const createPage = useCallback(
    async (parentId: string | null = null) => {
      setError(null);
      try {
        const created = await pageApi.create(parentId);
        const opened = await pageApi.open(created.id);
        setPages(await pageApi.list());
        setActivePageId(opened.id);
        return opened;
      } catch (reason) {
        setError(errorMessage(reason));
        return null;
      }
    },
    [],
  );

  const renamePage = useCallback(async (id: string, title: string) => {
    setError(null);
    try {
      const renamed = await pageApi.rename(id, title);
      setPages((current) =>
        current.map((page) => (page.id === renamed.id ? renamed : page)),
      );
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    }
  }, []);

  const movePage = useCallback(
    async (id: string, parentId: string | null, position: number) => {
      setError(null);
      try {
        setPages(await pageApi.move(id, parentId, position));
        return true;
      } catch (reason) {
        setError(errorMessage(reason));
        return false;
      }
    },
    [],
  );

  const setFavorite = useCallback(async (id: string, isFavorite: boolean) => {
    setError(null);
    try {
      const updated = await pageApi.setFavorite(id, isFavorite);
      setPages((current) =>
        current.map((page) => (page.id === updated.id ? updated : page)),
      );
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    }
  }, []);

  const deletePage = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const remaining = await pageApi.delete(id);
        setPages(remaining);
        if (activePageId === id) {
          const nextId = remaining[0]?.id ?? null;
          setActivePageId(nextId);
          if (nextId) {
            const opened = await pageApi.open(nextId);
            setPages((current) =>
              current.map((page) => (page.id === opened.id ? opened : page)),
            );
          }
        }
        return { success: true, nextActivePageId: activePageId === id ? remaining[0]?.id ?? null : activePageId };
      } catch (reason) {
        setError(errorMessage(reason));
        return { success: false, nextActivePageId: activePageId };
      }
    },
    [activePageId],
  );

  const refreshPages = useCallback(async () => {
    try {
      const loadedPages = await pageApi.list();
      setPages(loadedPages);
      return loadedPages;
    } catch (reason) {
      setError(errorMessage(reason));
      return [];
    }
  }, []);

  const setPagesList = useCallback((updatedPages: Page[]) => {
    setPages(updatedPages);
  }, []);

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? null,
    [activePageId, pages],
  );
  const favoritePages = useMemo(() => deriveFavoritePages(pages), [pages]);
  const recentPages = useMemo(() => deriveRecentPages(pages), [pages]);

  return {
    pages,
    activePage,
    activePageId,
    favoritePages,
    recentPages,
    loading,
    error,
    clearError: () => setError(null),
    createPage,
    selectPage,
    renamePage,
    movePage,
    setFavorite,
    deletePage,
    refreshPages,
    setPagesList,
  };
}
