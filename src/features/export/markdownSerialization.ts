import type { PartialBlock } from "@blocknote/core";

export type BlockNoteMarkdownConverter = (blocks: PartialBlock[]) => string;

export function serializeMarkdown(
  blocks: PartialBlock[],
  convertWithBlockNote: BlockNoteMarkdownConverter,
): string {
  if (blocks.length === 0) return "";

  // BlockNote emits valid `*` unordered-list markers. LocalNote normalizes these
  // to the more portable/documented `-` form, including GFM task-list items.
  return convertWithBlockNote(blocks).replace(/^(\s*)\* /gm, "$1- ");
}
