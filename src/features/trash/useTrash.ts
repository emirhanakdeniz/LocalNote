import { useCallback, useEffect, useState } from "react";
import { trashApi } from "./api";
import type { Page } from "../pages/types";

type UseTrashOptions = {
  onRestored?: (activePages: Page[]) => void;
};

export function useTrash(options?: UseTrashOptions) {
  const [trashPages, setTrashPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTrash = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await trashApi.list();
      setTrashPages(items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTrash();
  }, [refreshTrash]);

  const restorePage = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        setError(null);
        const activePages = await trashApi.restore(id);
        setTrashPages((prev) => prev.filter((p) => p.id !== id));
        options?.onRestored?.(activePages);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      }
    },
    [options]
  );

  const deletePermanently = useCallback(async (id: string): Promise<boolean> => {
    try {
      setError(null);
      const remainingTrash = await trashApi.deletePermanently(id);
      setTrashPages(remainingTrash);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, []);

  const emptyTrash = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      await trashApi.emptyTrash();
      setTrashPages([]);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, []);

  return {
    trashPages,
    trashCount: trashPages.length,
    loading,
    error,
    refreshTrash,
    restorePage,
    deletePermanently,
    emptyTrash,
  };
}
