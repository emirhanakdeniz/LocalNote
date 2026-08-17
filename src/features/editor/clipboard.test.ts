import { describe, expect, it, vi } from "vitest";
import {
  duplicateActiveBlock,
  duplicateBlock,
  handleEditorPaste,
  isInsideCodeBlock,
  sanitizeHtmlForPaste,
} from "./clipboard";
import type { Block, BlockNoteEditor } from "@blocknote/core";

describe("editor clipboard safety", () => {
  it("sanitizes dangerous and bloated HTML markup", () => {
    const dirty = `
      <script>alert("xss")</script>
      <style>body { color: red; }</style>
      <!-- Office comment -->
      <p>Hello <o:p>World</o:p></p>
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" />
    `;
    const clean = sanitizeHtmlForPaste(dirty);
    expect(clean).not.toContain("<script>");
    expect(clean).not.toContain("<style>");
    expect(clean).not.toContain("<!--");
    expect(clean).not.toContain("o:p");
    expect(clean).not.toContain("data:image/png;base64");
    expect(clean).toContain("Hello");
  });

  it("discards HTML that exceeds size threshold to protect against parser hangs", () => {
    const hugeHtml = "<p>" + "a".repeat(150000) + "</p>";
    expect(sanitizeHtmlForPaste(hugeHtml)).toBe("");
  });

  it("detects when cursor or target is inside a code block", () => {
    const codeEl = document.createElement("code");
    const preEl = document.createElement("pre");
    preEl.appendChild(codeEl);
    document.body.appendChild(preEl);

    expect(isInsideCodeBlock(codeEl)).toBe(true);
    expect(isInsideCodeBlock(preEl)).toBe(true);

    const normalP = document.createElement("p");
    document.body.appendChild(normalP);
    expect(isInsideCodeBlock(normalP)).toBe(false);

    document.body.removeChild(preEl);
    document.body.removeChild(normalP);
  });

  it("pastes raw text inside code blocks without parsing HTML", async () => {
    const codeEl = document.createElement("code");
    document.body.appendChild(codeEl);

    const mockEditor = {
      getTextCursorPosition: () => ({
        block: { type: "codeBlock", props: { language: "typescript" }, content: [] },
      }),
      insertBlocks: vi.fn(),
    } as unknown as BlockNoteEditor;

    const preventDefault = vi.fn();
    const event = {
      target: codeEl,
      preventDefault,
      clipboardData: {
        getData: (format: string) => {
          if (format === "text/plain") return "const x = 1;\nconst y = 2;";
          if (format === "text/html") return "<p>const x = 1;</p>";
          return "";
        },
      },
    } as unknown as ClipboardEvent;

    const handled = await handleEditorPaste(event, mockEditor);
    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(mockEditor.insertBlocks).not.toHaveBeenCalled();

    document.body.removeChild(codeEl);
  });

  it("allows default editor paste at cursor when outside code blocks", () => {
    const normalP = document.createElement("p");
    document.body.appendChild(normalP);

    const mockEditor = {
      getTextCursorPosition: () => ({
        block: { id: "b1", type: "paragraph", content: [] },
      }),
      insertBlocks: vi.fn(),
      document: [{ id: "b1" }],
    } as unknown as BlockNoteEditor;

    const preventDefault = vi.fn();
    const event = {
      target: normalP,
      preventDefault,
      clipboardData: {
        getData: (format: string) => {
          if (format === "text/plain") return "Hello world at cursor";
          if (format === "text/html") return "<p><strong>Hello world</strong> at cursor</p>";
          return "";
        },
      },
    } as unknown as ClipboardEvent;

    const handled = handleEditorPaste(event, mockEditor);
    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(mockEditor.insertBlocks).not.toHaveBeenCalled();

    document.body.removeChild(normalP);
  });

  it("duplicates the active block with duplicateActiveBlock", () => {
    const activeBlock = { id: "original-id", type: "paragraph", content: "Notes" };
    const mockEditor = {
      getTextCursorPosition: () => ({ block: activeBlock }),
      insertBlocks: vi.fn(),
    } as unknown as BlockNoteEditor;

    const result = duplicateActiveBlock(mockEditor);
    expect(result).toBe(true);
    expect(mockEditor.insertBlocks).toHaveBeenCalledWith(
      [{ type: "paragraph", content: "Notes" }],
      activeBlock,
      "after",
    );
  });

  it("duplicates an explicitly provided targetBlock rather than cursor block", () => {
    const cursorBlock = { id: "cursor-id", type: "paragraph", content: "Cursor text" };
    const targetBlock = { id: "target-id", type: "heading", props: { level: 1 }, content: "Target Heading" };
    const mockEditor = {
      getTextCursorPosition: () => ({ block: cursorBlock }),
      insertBlocks: vi.fn(),
    } as unknown as BlockNoteEditor;

    const result = duplicateBlock(mockEditor, targetBlock as unknown as Block);
    expect(result).toBe(true);
    expect(mockEditor.insertBlocks).toHaveBeenCalledWith(
      [{ type: "heading", props: { level: 1 }, content: "Target Heading" }],
      targetBlock,
      "after",
    );
  });
});
