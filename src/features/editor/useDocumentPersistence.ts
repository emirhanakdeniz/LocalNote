import type { PartialBlock } from "@blocknote/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { documentApi } from "./api";
import { MalformedDocumentError, parseDocument } from "./documentParsing";
import { SerializedSaveQueue } from "./SerializedSaveQueue";
import type { LoadedDocument, SaveStatus } from "./types";

export const AUTOSAVE_DEBOUNCE_MS = 500;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useDocumentPersistence() {
  const [document, setDocument] = useState<LoadedDocument | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [corrupted, setCorrupted] = useState(false);
  const queueRef = useRef(new SerializedSaveQueue(documentApi.save));
  const currentPageIdRef = useRef<string | null>(null);
  const latestJsonRef = useRef<string | null>(null);
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const corruptedRef = useRef(false);
  const editorKeyRef = useRef(0);

  const clearDebounce = useCallback(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const flush = useCallback(async (): Promise<boolean> => {
    clearDebounce();
    if (corruptedRef.current) return true;

    while (
      currentPageIdRef.current &&
      latestJsonRef.current !== null &&
      savedRevisionRef.current < revisionRef.current
    ) {
      const pageId = currentPageIdRef.current;
      const contentJson = latestJsonRef.current;
      const revision = revisionRef.current;
      setStatus("saving");
      setError(null);

      try {
        await queueRef.current.enqueue(pageId, contentJson);
        savedRevisionRef.current = Math.max(savedRevisionRef.current, revision);
      } catch (reason) {
        setStatus("error");
        setError(`Save failed. Your latest edits remain in memory. ${errorMessage(reason)}`);
        return false;
      }
    }

    await queueRef.current.idle();
    setStatus("saved");
    return true;
  }, [clearDebounce]);

  const scheduleAutosave = useCallback(() => {
    clearDebounce();
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void flush();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [clearDebounce, flush]);

  const loadPage = useCallback(
    async (pageId: string, flushCurrent = true): Promise<boolean> => {
      if (flushCurrent && !(await flush())) return false;

      clearDebounce();
      setLoading(true);
      setError(null);
      setCorrupted(false);
      corruptedRef.current = false;

      try {
        const stored = await documentApi.load(pageId);
        const blocks = parseDocument(stored.contentJson);
        editorKeyRef.current += 1;
        currentPageIdRef.current = pageId;
        setPageId(pageId);
        latestJsonRef.current = stored.contentJson ?? "[]";
        revisionRef.current = 0;
        savedRevisionRef.current = 0;
        setDocument({ pageId, blocks, editorKey: editorKeyRef.current });
        setStatus("saved");
        return true;
      } catch (reason) {
        currentPageIdRef.current = pageId;
        setPageId(pageId);
        latestJsonRef.current = null;
        revisionRef.current = 0;
        savedRevisionRef.current = 0;
        setDocument(null);
        const isCorrupted = reason instanceof MalformedDocumentError;
        setCorrupted(isCorrupted);
        corruptedRef.current = isCorrupted;
        setStatus("error");
        setError(errorMessage(reason));
        return true;
      } finally {
        setLoading(false);
      }
    },
    [clearDebounce, flush],
  );

  const clearDocument = useCallback(() => {
    clearDebounce();
    currentPageIdRef.current = null;
    setPageId(null);
    latestJsonRef.current = null;
    revisionRef.current = 0;
    savedRevisionRef.current = 0;
    corruptedRef.current = false;
    setDocument(null);
    setCorrupted(false);
    setError(null);
    setStatus("saved");
  }, [clearDebounce]);

  const documentChanged = useCallback(
    (pageId: string, blocks: PartialBlock[]) => {
      if (corruptedRef.current || currentPageIdRef.current !== pageId) return;

      try {
        latestJsonRef.current = JSON.stringify(blocks);
        revisionRef.current += 1;
        setStatus("unsaved");
        setError(null);
        scheduleAutosave();
      } catch (reason) {
        setStatus("error");
        setError(`Could not serialize this note. ${errorMessage(reason)}`);
      }
    },
    [scheduleAutosave],
  );

  const markInitializationError = useCallback((reason: Error) => {
    latestJsonRef.current = null;
    corruptedRef.current = true;
    setCorrupted(true);
    setStatus("error");
    setError(
      `BlockNote could not safely initialize this stored document. The original data has been preserved and autosave is disabled. ${reason.message}`,
    );
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;
    const window = getCurrentWindow();

    void window
      .onCloseRequested(async (event) => {
        event.preventDefault();
        if (await flush()) {
          try {
            await window.destroy();
          } catch (reason) {
            setStatus("error");
            setError(`Could not close LocalNote after saving. ${errorMessage(reason)}`);
          }
        }
      })
      .then((removeListener) => {
        if (active) unlisten = removeListener;
        else removeListener();
      });

    return () => {
      active = false;
      unlisten?.();
    };
  }, [flush]);

  useEffect(() => clearDebounce, [clearDebounce]);

  return {
    document,
    pageId,
    loading,
    status,
    error,
    corrupted,
    loadPage,
    clearDocument,
    documentChanged,
    flush,
    retrySave: flush,
    markInitializationError,
  };
}
