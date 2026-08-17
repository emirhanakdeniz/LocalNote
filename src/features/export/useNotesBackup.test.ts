import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNotesBackup } from "./useNotesBackup";
import { pageApi } from "../pages/api";
import { documentApi } from "../editor/api";
import { exportApi } from "./api";

vi.mock("../pages/api", () => ({
  pageApi: {
    list: vi.fn(),
  },
}));

vi.mock("../editor/api", () => ({
  documentApi: {
    load: vi.fn(),
  },
}));

vi.mock("./api", () => ({
  exportApi: {
    backupNotes: vi.fn(),
    openBackupFolder: vi.fn(),
  },
}));

describe("useNotesBackup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports all active notes with live progress updates and reports success", async () => {
    const flushMock = vi.fn().mockResolvedValue(true);
    vi.mocked(pageApi.list).mockResolvedValue([
      {
        id: "p1",
        title: "Project Alpha",
        parentId: null,
        position: 0,
        isFavorite: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        lastOpenedAt: null,
      },
      {
        id: "p2",
        title: "Project Beta",
        parentId: "p1",
        position: 0,
        isFavorite: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        lastOpenedAt: null,
      },
    ]);
    vi.mocked(documentApi.load).mockImplementation((id) =>
      Promise.resolve({
        pageId: id,
        contentJson: JSON.stringify([{ type: "paragraph", content: `Content of ${id}` }]),
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    vi.mocked(exportApi.backupNotes).mockResolvedValue({
      destinationPath: "C:\\Users\\Test\\Documents\\LocalNote Notes",
      exportedCount: 2,
      success: true,
    });

    const { result } = renderHook(() => useNotesBackup(flushMock));

    expect(result.current.status).toBe("idle");
    expect(result.current.progress.current).toBe(0);

    let successPromise: Promise<boolean>;
    await act(async () => {
      successPromise = result.current.startBackup();
      await successPromise;
    });

    expect(flushMock).toHaveBeenCalled();
    expect(pageApi.list).toHaveBeenCalled();
    expect(documentApi.load).toHaveBeenCalledWith("p1");
    expect(documentApi.load).toHaveBeenCalledWith("p2");
    expect(exportApi.backupNotes).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "p1",
        title: "Project Alpha",
        parentId: null,
        markdown: expect.stringContaining("Content of p1"),
      }),
      expect.objectContaining({
        id: "p2",
        title: "Project Beta",
        parentId: "p1",
        markdown: expect.stringContaining("Content of p2"),
      }),
    ]);

    expect(result.current.status).toBe("success");
    expect(result.current.exportedCount).toBe(2);
    expect(result.current.destinationPath).toBe("C:\\Users\\Test\\Documents\\LocalNote Notes");
    expect(result.current.error).toBeNull();
  });

  it("handles empty note collection gracefully", async () => {
    const flushMock = vi.fn().mockResolvedValue(true);
    vi.mocked(pageApi.list).mockResolvedValue([]);
    vi.mocked(exportApi.backupNotes).mockResolvedValue({
      destinationPath: "C:\\Users\\Test\\Documents\\LocalNote Notes",
      exportedCount: 0,
      success: true,
    });

    const { result } = renderHook(() => useNotesBackup(flushMock));

    await act(async () => {
      await result.current.startBackup();
    });

    expect(result.current.status).toBe("success");
    expect(result.current.exportedCount).toBe(0);
  });

  it("stops and reports error when flush fails", async () => {
    const flushMock = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() => useNotesBackup(flushMock));

    await act(async () => {
      const ok = await result.current.startBackup();
      expect(ok).toBe(false);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("Could not save pending edits");
    expect(pageApi.list).not.toHaveBeenCalled();
  });

  it("triggers openBackupFolder on openFolder", async () => {
    vi.mocked(exportApi.openBackupFolder).mockResolvedValue(undefined);
    const { result } = renderHook(() => useNotesBackup());

    await act(async () => {
      await result.current.openFolder();
    });

    expect(exportApi.openBackupFolder).toHaveBeenCalled();
  });
});
