import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTrash } from "./useTrash";
import { trashApi } from "./api";
import type { Page } from "../pages/types";

vi.mock("./api", () => ({
  trashApi: {
    list: vi.fn(),
    restore: vi.fn(),
    deletePermanently: vi.fn(),
    emptyTrash: vi.fn(),
  },
}));

function mockTrashedPage(id: string, title: string): Page {
  return {
    id,
    title,
    parentId: null,
    position: 0,
    isFavorite: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt: null,
    deletedAt: "2026-01-01T00:02:00.000Z",
  };
}

describe("useTrash hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads trashed pages on mount", async () => {
    const trashed = [mockTrashedPage("p1", "Note 1"), mockTrashedPage("p2", "Note 2")];
    vi.mocked(trashApi.list).mockResolvedValue(trashed);

    const { result } = renderHook(() => useTrash());

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await result.current.refreshTrash();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.trashPages).toEqual(trashed);
    expect(result.current.trashCount).toBe(2);
  });

  it("restores page and updates state", async () => {
    const trashed = [mockTrashedPage("p1", "Note 1"), mockTrashedPage("p2", "Note 2")];
    vi.mocked(trashApi.list).mockResolvedValue(trashed);
    vi.mocked(trashApi.restore).mockResolvedValueOnce([mockTrashedPage("p1", "Note 1")]);

    const onRestored = vi.fn();
    const { result } = renderHook(() => useTrash({ onRestored }));

    await act(async () => {
      await result.current.refreshTrash();
    });

    let success = false;
    await act(async () => {
      success = await result.current.restorePage("p1");
    });

    expect(success).toBe(true);
    expect(trashApi.restore).toHaveBeenCalledWith("p1");
    expect(result.current.trashPages.map((p) => p.id)).toEqual(["p2"]);
    expect(onRestored).toHaveBeenCalledOnce();
  });

  it("permanently deletes page", async () => {
    const trashed = [mockTrashedPage("p1", "Note 1"), mockTrashedPage("p2", "Note 2")];
    vi.mocked(trashApi.list).mockResolvedValue(trashed);
    vi.mocked(trashApi.deletePermanently).mockResolvedValueOnce([mockTrashedPage("p2", "Note 2")]);

    const { result } = renderHook(() => useTrash());

    await act(async () => {
      await result.current.refreshTrash();
    });

    let success = false;
    await act(async () => {
      success = await result.current.deletePermanently("p1");
    });

    expect(success).toBe(true);
    expect(trashApi.deletePermanently).toHaveBeenCalledWith("p1");
    expect(result.current.trashPages.map((p) => p.id)).toEqual(["p2"]);
  });

  it("empties trash completely", async () => {
    const trashed = [mockTrashedPage("p1", "Note 1")];
    vi.mocked(trashApi.list).mockResolvedValue(trashed);
    vi.mocked(trashApi.emptyTrash).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useTrash());

    await act(async () => {
      await result.current.refreshTrash();
    });

    let success = false;
    await act(async () => {
      success = await result.current.emptyTrash();
    });

    expect(success).toBe(true);
    expect(trashApi.emptyTrash).toHaveBeenCalledOnce();
    expect(result.current.trashPages).toEqual([]);
    expect(result.current.trashCount).toBe(0);
  });
});
