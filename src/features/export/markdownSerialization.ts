import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";

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

let sharedConverterEditor: BlockNoteEditor | null = null;

export function blocksToMarkdown(blocks: PartialBlock[]): string {
  if (blocks.length === 0) return "";
  if (!sharedConverterEditor) {
    sharedConverterEditor = BlockNoteEditor.create();
  }
  return serializeMarkdown(blocks, (document) =>
    sharedConverterEditor!.blocksToMarkdownLossy(document),
  );
}
