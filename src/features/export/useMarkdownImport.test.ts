import { BlockNoteEditor } from "@blocknote/core";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportApi } from "./api";
import { useMarkdownImport } from "./useMarkdownImport";

vi.mock("./api", () => ({
  exportApi: {
    selectMarkdownFiles: vi.fn(),
    importMarkdownNotes: vi.fn(),
  },
}));

describe("useMarkdownImport", () => {
  const parseMarkdown = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(BlockNoteEditor, "create").mockReturnValue({
      tryParseMarkdownToBlocks: parseMarkdown,
    } as unknown as ReturnType<typeof BlockNoteEditor.create>);
  });

  it("parses multiple UTF-8 files, derives titles, and submits one atomic batch", async () => {
    vi.mocked(exportApi.selectMarkdownFiles).mockResolvedValue([
      { fileName: "Proje Notları.md", markdown: "# Merhaba\nTürkçe içerik" },
      { fileName: "Empty.MD", markdown: "" },
    ]);
    parseMarkdown
      .mockResolvedValueOnce([{ type: "heading", content: "Merhaba" }])
      .mockResolvedValueOnce([]);
    const importResult = {
      importedCount: 2,
      pages: [],
      firstPageId: "first-import",
    };
    vi.mocked(exportApi.importMarkdownNotes).mockResolvedValue(importResult);
    const onImported = vi.fn();
    const { result } = renderHook(() => useMarkdownImport(onImported));

    await act(async () => {
      await result.current.startImport();
    });

    expect(parseMarkdown).toHaveBeenNthCalledWith(1, "# Merhaba\nTürkçe içerik");
    expect(parseMarkdown).toHaveBeenNthCalledWith(2, "");
    expect(exportApi.importMarkdownNotes).toHaveBeenCalledTimes(1);
    expect(exportApi.importMarkdownNotes).toHaveBeenCalledWith([
      {
        title: "Proje Notları",
        contentJson: JSON.stringify([{ type: "heading", content: "Merhaba" }]),
      },
      { title: "Empty", contentJson: "[]" },
    ]);
    expect(onImported).toHaveBeenCalledWith(importResult);
    expect(result.current.status).toBe("success");
    expect(result.current.importedCount).toBe(2);
  });

  it("returns silently to idle when file selection is cancelled", async () => {
    vi.mocked(exportApi.selectMarkdownFiles).mockResolvedValue([]);
    const onImported = vi.fn();
    const { result } = renderHook(() => useMarkdownImport(onImported));

    await act(async () => {
      await result.current.startImport();
    });

    expect(result.current.status).toBe("idle");
    expect(exportApi.importMarkdownNotes).not.toHaveBeenCalled();
    expect(onImported).not.toHaveBeenCalled();
  });

  it("reports conversion errors without submitting any notes", async () => {
    vi.mocked(exportApi.selectMarkdownFiles).mockResolvedValue([
      { fileName: "broken.md", markdown: "broken" },
    ]);
    parseMarkdown.mockRejectedValue(new Error("Invalid Markdown"));
    const { result } = renderHook(() => useMarkdownImport(vi.fn()));

    await act(async () => {
      await result.current.startImport();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("Invalid Markdown");
    expect(exportApi.importMarkdownNotes).not.toHaveBeenCalled();
  });
});
