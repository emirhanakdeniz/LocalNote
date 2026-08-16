import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it, vi } from "vitest";
import { getBlockText, transformBlock, transformOptions } from "./blockTransform";
import { localNoteSchema } from "./codeBlock";

describe("Block transformations", () => {
  it("includes all required Notion/LocalNote block transformation types", () => {
    const ids = transformOptions.map((opt) => opt.id);
    expect(ids).toContain("paragraph");
    expect(ids).toContain("h1");
    expect(ids).toContain("h2");
    expect(ids).toContain("h3");
    expect(ids).toContain("bulletList");
    expect(ids).toContain("numberedList");
    expect(ids).toContain("todo");
    expect(ids).toContain("codeBlock");
  });

  it("transforms paragraph into heading 1 while preserving content", () => {
    const editor = BlockNoteEditor.create({
      schema: localNoteSchema,
      initialContent: [
        {
          id: "block-1",
          type: "paragraph",
          content: "Architecture Overview",
        },
      ],
    });

    const success = transformBlock(editor, "block-1", "heading", { level: 1 });
    expect(success).toBe(true);

    const block = editor.document[0];
    expect(block.type).toBe("heading");
    expect((block.props as { level?: number }).level).toBe(1);
    expect(getBlockText(block)).toBe("Architecture Overview");
  });

  it("transforms heading into code block with stored language metadata", () => {
    const editor = BlockNoteEditor.create({
      schema: localNoteSchema,
      initialContent: [
        {
          id: "block-2",
          type: "heading",
          props: { level: 2 },
          content: "const a = 10;",
        },
      ],
    });

    const success = transformBlock(editor, "block-2", "codeBlock", { language: "typescript" });
    expect(success).toBe(true);

    const block = editor.document[0];
    expect(block.type).toBe("codeBlock");
    expect((block.props as { language?: string }).language).toBe("typescript");
    expect(getBlockText(block)).toBe("const a = 10;");
  });

  it("transforms code block into bullet list", () => {
    const editor = BlockNoteEditor.create({
      schema: localNoteSchema,
      initialContent: [
        {
          id: "block-3",
          type: "codeBlock",
          props: { language: "text" },
          content: "Bullet item text",
        },
      ],
    });

    const success = transformBlock(editor, "block-3", "bulletListItem");
    expect(success).toBe(true);

    const block = editor.document[0];
    expect(block.type).toBe("bulletListItem");
    expect(getBlockText(block)).toBe("Bullet item text");
  });

  it("gracefully handles invalid block id without throwing", () => {
    const mockEditor = {
      getBlock: vi.fn().mockReturnValue(null),
    } as unknown as BlockNoteEditor;

    const success = transformBlock(mockEditor, "non-existent", "paragraph");
    expect(success).toBe(false);
  });
});
