import type { Block, BlockNoteEditor, PartialBlock } from "@blocknote/core";

export function sanitizeHtmlForPaste(html: string): string {
  if (!html) return "";

  // Strip scripts, style tags, xml namespaces, comments, and huge base64 data URIs
  const cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?(?:o|v|w|x|p):[^>]*>/gi, "")
    .replace(/data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+/gi, "");

  // If HTML is too large (> 100KB), truncate or return empty to prevent blocking parser
  if (cleaned.length > 100000) {
    return "";
  }

  return cleaned.trim();
}

export function isInsideCodeBlock(target: EventTarget | null, editor?: BlockNoteEditor): boolean {
  if (target instanceof HTMLElement) {
    if (
      target.closest('.bn-block-content[data-content-type="codeBlock"]') ||
      target.closest("pre") ||
      target.closest("code")
    ) {
      return true;
    }
  }

  try {
    const activeBlock = editor?.getTextCursorPosition?.()?.block;
    if (activeBlock?.type === "codeBlock") {
      return true;
    }
  } catch {
    // Ignore error
  }

  return false;
}

export function handleEditorPaste(
  event: ClipboardEvent,
  editor: BlockNoteEditor,
): boolean {
  const clipboardData = event.clipboardData;
  if (!clipboardData) return false;

  const plainText = clipboardData.getData("text/plain") ?? "";

  // 1. Inside a Code Block: Always paste raw text preserving newlines & indentation
  if (isInsideCodeBlock(event.target, editor)) {
    if (plainText) {
      event.preventDefault();
      try {
        document.execCommand("insertText", false, plainText);
      } catch {
        // Fallback for environments without execCommand
      }
      return true;
    }
    return false;
  }

  // 2. Outside code blocks: Let ProseMirror / BlockNote handle pasting directly at cursor position
  return false;
}

export function duplicateBlock(
  editor: BlockNoteEditor,
  targetBlock?: Block | null,
): boolean {
  try {
    const blockToDuplicate =
      targetBlock ?? editor.getTextCursorPosition?.()?.block;
    if (!blockToDuplicate) return false;

    // Clone the block without its ID to ensure a unique block is generated
    const rawClone = JSON.parse(
      JSON.stringify(blockToDuplicate),
    ) as PartialBlock;
    delete (rawClone as { id?: string }).id;

    editor.insertBlocks([rawClone], blockToDuplicate, "after");
    return true;
  } catch {
    return false;
  }
}

export function duplicateActiveBlock(editor: BlockNoteEditor): boolean {
  return duplicateBlock(editor);
}
