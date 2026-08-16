import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it } from "vitest";
import { codeLanguages, localNoteSchema } from "./codeBlock";

describe("LocalNote code blocks", () => {
  it("keeps the supported language set intentionally bounded", () => {
    expect(Object.keys(codeLanguages)).toEqual([
      "text",
      "java",
      "javascript",
      "typescript",
      "json",
      "sql",
      "shellscript",
      "powershell",
      "python",
      "html",
      "css",
    ]);
    expect(codeLanguages.typescript.aliases).toContain("ts");
    expect(codeLanguages.shellscript.aliases).toContain("bash");
  });

  it("round-trips code language metadata through the editor schema", () => {
    const editor = BlockNoteEditor.create({
      schema: localNoteSchema,
      initialContent: [
        {
          type: "codeBlock",
          props: { language: "typescript" },
          content: "const answer: number = 42;",
        },
      ],
    });
    const block = editor.document[0];

    expect(block.type).toBe("codeBlock");
    if (block.type !== "codeBlock") throw new Error("Expected a code block");
    expect(block.props.language).toBe("typescript");

    editor.updateBlock(block.id, { props: { language: "python" } });
    const updated = editor.document[0];
    if (updated.type !== "codeBlock") throw new Error("Expected a code block");
    expect(updated.props.language).toBe("python");
    expect(updated.content).toEqual(block.content);
  });
});
