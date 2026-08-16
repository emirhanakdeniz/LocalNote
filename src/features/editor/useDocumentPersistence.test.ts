import type { PartialBlock } from "@blocknote/core";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { documentApi } from "./api";
import { AUTOSAVE_DEBOUNCE_MS, useDocumentPersistence } from "./useDocumentPersistence";

const destroyMock = vi.hoisted(() => vi.fn());
const closeHandlerRef = vi.hoisted(() => ({
  current: null as null | ((event: { preventDefault: () => void }) => Promise<void>),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    destroy: destroyMock,
    onCloseRequested: vi.fn(async (handler) => {
      closeHandlerRef.current = handler;
      return () => undefined;
    }),
  }),
}));

describe("useDocumentPersistence Reliability & Stress Suite", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    closeHandlerRef.current = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("handles a burst of rapid document changes by debouncing to a single save", async () => {
    const savedPayloads: string[] = [];
    vi.spyOn(documentApi, "load").mockResolvedValue({
      pageId: "page-1",
      contentJson: JSON.stringify([{ id: "b0", type: "paragraph", content: "Initial" }]),
      updatedAt: "2026-08-17T00:00:00Z",
    });
    vi.spyOn(documentApi, "save").mockImplementation(async (pageId, contentJson) => {
      savedPayloads.push(contentJson);
      return { pageId, contentJson, updatedAt: "2026-08-17T00:00:01Z" };
    });

    const { result } = renderHook(() => useDocumentPersistence());

    await act(async () => {
      await result.current.loadPage("page-1");
    });
    expect(result.current.status).toBe("saved");

    // Simulate 30 rapid keystrokes within 200ms
    act(() => {
      for (let i = 1; i <= 30; i++) {
        const block: PartialBlock = {
          id: "b0",
          type: "paragraph",
          props: {},
          content: `Keystroke ${i}`,
        };
        result.current.documentChanged("page-1", [block]);
        vi.advanceTimersByTime(10);
      }
    });

    expect(result.current.status).toBe("unsaved");
    expect(savedPayloads).toHaveLength(0);

    // Fast-forward past the autosave debounce threshold
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
      await Promise.resolve();
    });

    expect(result.current.status).toBe("saved");
    expect(savedPayloads).toHaveLength(1);
    expect(savedPayloads[0]).toContain("Keystroke 30");
  });

  it("guarantees flush-before-load when switching between pages rapidly", async () => {
    const saveOrder: string[] = [];
    const loadOrder: string[] = [];

    vi.spyOn(documentApi, "load").mockImplementation(async (pageId) => {
      loadOrder.push(pageId);
      return { pageId, contentJson: "[]", updatedAt: "2026-08-17T00:00:00Z" };
    });

    vi.spyOn(documentApi, "save").mockImplementation(async (pageId, contentJson) => {
      saveOrder.push(`${pageId}:${contentJson}`);
      return { pageId, contentJson, updatedAt: "2026-08-17T00:00:01Z" };
    });

    const { result } = renderHook(() => useDocumentPersistence());

    await act(async () => {
      await result.current.loadPage("page-alpha");
    });

    act(() => {
      const block: PartialBlock = {
        id: "b1",
        type: "paragraph",
        props: {},
        content: "Alpha Draft",
      };
      result.current.documentChanged("page-alpha", [block]);
    });
    expect(result.current.status).toBe("unsaved");

    // Immediately switch to page-beta without waiting for timer
    await act(async () => {
      const loaded = await result.current.loadPage("page-beta");
      expect(loaded).toBe(true);
    });

    expect(saveOrder).toHaveLength(1);
    expect(saveOrder[0]).toContain("page-alpha");
    expect(saveOrder[0]).toContain("Alpha Draft");
    expect(loadOrder).toEqual(["page-alpha", "page-beta"]);
    expect(result.current.pageId).toBe("page-beta");
    expect(result.current.status).toBe("saved");
  });

  it("retains in-memory document state and reports error when autosave fails", async () => {
    vi.spyOn(documentApi, "load").mockResolvedValue({
      pageId: "page-fail",
      contentJson: "[]",
      updatedAt: "2026-08-17T00:00:00Z",
    });
    const saveSpy = vi.spyOn(documentApi, "save").mockRejectedValue(new Error("Disk quota exceeded"));

    const { result } = renderHook(() => useDocumentPersistence());

    await act(async () => {
      await result.current.loadPage("page-fail");
    });

    act(() => {
      const block: PartialBlock = {
        id: "b1",
        type: "paragraph",
        props: {},
        content: "Critical Unsaved Content",
      };
      result.current.documentChanged("page-fail", [block]);
    });

    await act(async () => {
      const flushResult = await result.current.flush();
      expect(flushResult).toBe(false);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("Disk quota exceeded");

    // Now disk becomes available again
    saveSpy.mockResolvedValueOnce({
      pageId: "page-fail",
      contentJson: JSON.stringify([{ id: "b1", type: "paragraph", content: "Critical Unsaved Content" }]),
      updatedAt: "2026-08-17T00:00:02Z",
    });

    await act(async () => {
      const retryResult = await result.current.retrySave();
      expect(retryResult).toBe(true);
    });

    expect(result.current.status).toBe("saved");
    expect(result.current.error).toBeNull();
  });

  it("locks autosave and never overwrites malformed stored documents", async () => {
    const saveSpy = vi.spyOn(documentApi, "save");
    vi.spyOn(documentApi, "load").mockResolvedValue({
      pageId: "page-corrupt",
      contentJson: "{ not valid json [",
      updatedAt: "2026-08-17T00:00:00Z",
    });

    const { result } = renderHook(() => useDocumentPersistence());

    await act(async () => {
      await result.current.loadPage("page-corrupt");
    });

    expect(result.current.corrupted).toBe(true);
    expect(result.current.status).toBe("error");

    // Attempting to push changes or flush must be completely blocked
    act(() => {
      const block: PartialBlock = {
        id: "b1",
        type: "paragraph",
        props: {},
        content: "New text",
      };
      result.current.documentChanged("page-corrupt", [block]);
    });

    await act(async () => {
      await result.current.flush();
    });

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("flushes pending edits before allowing window destruction on close request", async () => {
    const saved: string[] = [];
    vi.spyOn(documentApi, "load").mockResolvedValue({
      pageId: "page-close",
      contentJson: "[]",
      updatedAt: "2026-08-17T00:00:00Z",
    });
    vi.spyOn(documentApi, "save").mockImplementation(async (pageId, contentJson) => {
      saved.push(contentJson);
      return { pageId, contentJson, updatedAt: "2026-08-17T00:00:01Z" };
    });

    const { result } = renderHook(() => useDocumentPersistence());

    await act(async () => {
      await result.current.loadPage("page-close");
    });

    act(() => {
      const block: PartialBlock = {
        id: "b1",
        type: "paragraph",
        props: {},
        content: "Closing Note Edits",
      };
      result.current.documentChanged("page-close", [block]);
    });

    expect(closeHandlerRef.current).not.toBeNull();
    const preventDefault = vi.fn();

    await act(async () => {
      await closeHandlerRef.current!({ preventDefault });
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toContain("Closing Note Edits");
    expect(destroyMock).toHaveBeenCalled();
  });
});
