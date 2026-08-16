import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";
import { describe, expect, it } from "vitest";
import { serializeMarkdown } from "./markdownSerialization";

function markdown(blocks: PartialBlock[]): string {
  const editor = BlockNoteEditor.create();
  return serializeMarkdown(blocks, (document) =>
    editor.blocksToMarkdownLossy(document),
  );
}

describe("BlockNote Markdown serialization", () => {
  it("exports paragraphs, headings, quotes, dividers, and an empty document", () => {
    const result = markdown([
      { type: "heading", props: { level: 1 }, content: "Heading one" },
      { type: "heading", props: { level: 2 }, content: "Heading two" },
      { type: "heading", props: { level: 3 }, content: "Heading three" },
      { type: "paragraph", content: "Plain paragraph" },
      { type: "quote", content: "Quoted note" },
      { type: "divider" },
    ]);

    expect(result).toContain("# Heading one");
    expect(result).toContain("## Heading two");
    expect(result).toContain("### Heading three");
    expect(result).toContain("Plain paragraph");
    expect(result).toContain("> Quoted note");
    expect(result).toMatch(/(?:---|\*\*\*)/);
    expect(markdown([])).toBe("");
  });

  it("exports bullet, numbered, checked, unchecked, and nested list items", () => {
    const result = markdown([
      {
        type: "bulletListItem",
        content: "Bullet parent",
        children: [{ type: "bulletListItem", content: "Bullet child" }],
      },
      { type: "numberedListItem", content: "Numbered item" },
      { type: "checkListItem", props: { checked: false }, content: "Pending" },
      { type: "checkListItem", props: { checked: true }, content: "Complete" },
    ]);

    expect(result).toContain("- Bullet parent");
    expect(result).toMatch(/\n\s+- Bullet child/);
    expect(result).toContain("1. Numbered item");
    expect(result).toContain("- [ ] Pending");
    expect(result).toContain("- [x] Complete");
  });

  it("exports fenced code with its language and protects embedded backticks", () => {
    const result = markdown([
      {
        type: "codeBlock",
        props: { language: "java" },
        content: "public class Example {\n  // ``` embedded\n}",
      },
    ]);

    expect(result).toContain("````java");
    expect(result).toContain("// ``` embedded");
    expect(result).toContain("\n````");
  });

  it("exports links and mixed bold, italic, strikethrough, and inline code", () => {
    const result = markdown([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "bold", styles: { bold: true } },
          { type: "text", text: " ", styles: {} },
          { type: "text", text: "italic", styles: { italic: true } },
          { type: "text", text: " ", styles: {} },
          { type: "text", text: "strike", styles: { strike: true } },
          { type: "text", text: " ", styles: {} },
          { type: "text", text: "code", styles: { code: true } },
          { type: "text", text: " ", styles: {} },
          { type: "text", text: "both", styles: { bold: true, italic: true } },
          { type: "text", text: " ", styles: {} },
          {
            type: "link",
            href: "https://example.com",
            content: [{ type: "text", text: "link", styles: {} }],
          },
        ],
      },
    ]);

    expect(result).toContain("**bold**");
    expect(result).toContain("*italic*");
    expect(result).toContain("~~strike~~");
    expect(result).toContain("`code`");
    expect(result).toMatch(/\*{3}both\*{3}|\*\*\*both\*\*\*/);
    expect(result).toContain("[link](https://example.com)");
  });
});
