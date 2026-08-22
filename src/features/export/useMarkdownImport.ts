import { BlockNoteEditor } from "@blocknote/core";
import { useCallback, useRef, useState } from "react";
import { localNoteSchema } from "../editor/codeBlock";
import { exportApi, type MarkdownImportResult } from "./api";

export type MarkdownImportStatus = "idle" | "in_progress" | "success" | "error";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function titleFromFileName(fileName: string): string {
  const title = fileName.replace(/\.md$/i, "").trim();
  return title || "Untitled";
}

export function useMarkdownImport(
  onImported: (result: MarkdownImportResult) => void | Promise<void>,
) {
  const [status, setStatus] = useState<MarkdownImportStatus>("idle");
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<ReturnType<typeof BlockNoteEditor.create> | null>(null);

  const startImport = useCallback(async () => {
    setStatus("in_progress");
    setError(null);
    setImportedCount(0);
    try {
      const sources = await exportApi.selectMarkdownFiles();
      if (sources.length === 0) {
        setStatus("idle");
        return;
      }

      if (!editorRef.current) {
        editorRef.current = BlockNoteEditor.create({ schema: localNoteSchema });
      }
      const editor = editorRef.current;
      const notes = await Promise.all(
        sources.map(async (source) => ({
          title: titleFromFileName(source.fileName),
          contentJson: JSON.stringify(
            await editor.tryParseMarkdownToBlocks(source.markdown),
          ),
        })),
      );
      const result = await exportApi.importMarkdownNotes(notes);
      await onImported(result);
      setImportedCount(result.importedCount);
      setStatus("success");
    } catch (reason) {
      setError(`Could not import Markdown: ${errorMessage(reason)}`);
      setStatus("error");
    }
  }, [onImported]);

  const reset = useCallback(() => {
    setStatus("idle");
    setImportedCount(0);
    setError(null);
  }, []);

  return { status, importedCount, error, startImport, reset };
}
