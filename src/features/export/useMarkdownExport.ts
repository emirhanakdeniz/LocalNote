import type { PartialBlock } from "@blocknote/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { documentApi } from "../editor/api";
import { parseDocument } from "../editor/documentParsing";
import { exportApi } from "./api";

export type MarkdownSerializer = (blocks: PartialBlock[]) => string;
export type ExportStatus = "idle" | "exporting" | "success" | "error";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useMarkdownExport(
  activePageId: string | null,
  flush: () => Promise<boolean>,
) {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    runningRef.current = false;
    clearResetTimer();
    setStatus("idle");
    setError(null);
  }, [activePageId, clearResetTimer]);

  useEffect(() => clearResetTimer, [clearResetTimer]);

  const exportPage = useCallback(
    async (serialize: MarkdownSerializer): Promise<boolean> => {
      if (!activePageId || runningRef.current) return false;
      runningRef.current = true;
      clearResetTimer();
      setStatus("exporting");
      setError(null);

      try {
        if (!(await flush())) {
          setStatus("error");
          setError(
            "Export stopped because the latest edits could not be saved. Your note remains open and unchanged.",
          );
          return false;
        }

        // Reload after the flush so conversion uses the exact SQLite source of truth,
        // not a potentially stale render or search-index projection.
        const persisted = await documentApi.load(activePageId);
        const blocks = parseDocument(persisted.contentJson);
        const markdown = serialize(blocks);
        const result = await exportApi.saveMarkdown(
          activePageId,
          persisted.contentJson,
          markdown,
        );

        if (!result.exported) {
          setStatus("idle");
          return false;
        }

        setStatus("success");
        resetTimerRef.current = setTimeout(() => {
          resetTimerRef.current = null;
          setStatus("idle");
        }, 2500);
        return true;
      } catch (reason) {
        setStatus("error");
        setError(
          `Could not export this page. The original note was not changed. ${errorMessage(reason)}`,
        );
        return false;
      } finally {
        runningRef.current = false;
      }
    },
    [activePageId, clearResetTimer, flush],
  );

  return { status, error, exportPage };
}
