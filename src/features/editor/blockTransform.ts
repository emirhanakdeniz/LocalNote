import type { Block, BlockNoteEditor } from "@blocknote/core";
import type { IconName } from "../../components/Icon";

export type TransformOption = {
  id: string;
  label: string;
  type: string;
  props?: Record<string, unknown>;
  icon?: IconName;
  mark?: string;
};

export const transformOptions: TransformOption[] = [
  { id: "paragraph", label: "Text", type: "paragraph", mark: "¶" },
  { id: "h1", label: "Heading 1", type: "heading", props: { level: 1 }, mark: "H1" },
  { id: "h2", label: "Heading 2", type: "heading", props: { level: 2 }, mark: "H2" },
  { id: "h3", label: "Heading 3", type: "heading", props: { level: 3 }, mark: "H3" },
  { id: "h4", label: "Heading 4", type: "heading", props: { level: 4 }, mark: "H4" },
  { id: "h5", label: "Heading 5", type: "heading", props: { level: 5 }, mark: "H5" },
  { id: "h6", label: "Heading 6", type: "heading", props: { level: 6 }, mark: "H6" },
  { id: "bulletList", label: "Bullet List", type: "bulletListItem", mark: "•" },
  { id: "numberedList", label: "Numbered List", type: "numberedListItem", mark: "1." },
  { id: "todo", label: "To-do List", type: "checkListItem", mark: "☑" },
  { id: "codeBlock", label: "Code Block", type: "codeBlock", props: { language: "text" }, mark: "</>" },
];

export function getBlockText(block: Block): string {
  const content = (block as unknown as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null && "text" in item) {
          return (item as { text?: string }).text ?? "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

export function transformBlock(
  editor: BlockNoteEditor,
  blockId: string,
  targetType: string,
  targetProps?: Record<string, unknown>,
): boolean {
  try {
    const existingBlock = editor.getBlock(blockId);
    if (!existingBlock) return false;

    const text = getBlockText(existingBlock);

    if (existingBlock.type === "codeBlock" && targetType !== "codeBlock") {
      const inlineContent = text ? [{ type: "text", text, styles: {} }] : [];
      editor.updateBlock(blockId, {
        type: targetType as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        props: targetProps as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        content: inlineContent as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      });
    } else if (existingBlock.type !== "codeBlock" && targetType === "codeBlock") {
      editor.updateBlock(blockId, {
        type: targetType as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        props: targetProps as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        content: text as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      });
    } else {
      editor.updateBlock(blockId, {
        type: targetType as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        props: targetProps as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      });
    }
    return true;
  } catch {
    return false;
  }
}
