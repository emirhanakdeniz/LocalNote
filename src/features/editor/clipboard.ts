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

export async function handleEditorPaste(
  event: ClipboardEvent,
  editor: BlockNoteEditor,
): Promise<boolean> {
  const clipboardData = event.clipboardData;
  if (!clipboardData) return false;

  const plainText = clipboardData.getData("text/plain") ?? "";
  const rawHtml = clipboardData.getData("text/html") ?? "";

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

  // 2. If no content at all, allow default
  if (!plainText && !rawHtml) {
    return false;
  }

  // 3. Try parsing rich HTML safely if available and not overly large
  if (rawHtml) {
    const sanitizedHtml = sanitizeHtmlForPaste(rawHtml);
    if (sanitizedHtml && typeof editor.tryParseHTMLToBlocks === "function") {
      try {
        const blocks = await editor.tryParseHTMLToBlocks(sanitizedHtml);
        if (blocks && Array.isArray(blocks) && blocks.length > 0) {
          event.preventDefault();
          const currentPosition = editor.getTextCursorPosition?.();
          if (currentPosition?.block) {
            editor.insertBlocks(blocks as PartialBlock[], currentPosition.block, "after");
          } else {
            editor.insertBlocks(blocks as PartialBlock[], editor.document[editor.document.length - 1], "after");
          }
          return true;
        }
      } catch {
        // Fallback to plain text on any HTML parsing error
      }
    }
  }

  // 4. Multi-line plain text handling
  if (plainText && plainText.includes("\n")) {
    event.preventDefault();
    try {
      if (typeof editor.tryParseMarkdownToBlocks === "function") {
        const blocks = await editor.tryParseMarkdownToBlocks(plainText);
        if (blocks && Array.isArray(blocks) && blocks.length > 0) {
          const currentPosition = editor.getTextCursorPosition?.();
          if (currentPosition?.block) {
            editor.insertBlocks(blocks as PartialBlock[], currentPosition.block, "after");
          } else {
            editor.insertBlocks(blocks as PartialBlock[], editor.document[editor.document.length - 1], "after");
          }
          return true;
        }
      }
    } catch {
      // Fallback
    }

    // Fallback: split by line into simple paragraph blocks
    try {
      const lines = plainText.split(/\r?\n/).filter((line) => line.length > 0);
      if (lines.length > 0) {
        const paragraphBlocks: PartialBlock[] = lines.map((line) => ({
          type: "paragraph",
          content: line,
        }));
        const currentPosition = editor.getTextCursorPosition?.();
        if (currentPosition?.block) {
          editor.insertBlocks(paragraphBlocks, currentPosition.block, "after");
        } else {
          editor.insertBlocks(paragraphBlocks, editor.document[editor.document.length - 1], "after");
        }
        return true;
      }
    } catch {
      // Fallback to execCommand
    }
  }

  // 5. Single-line plain text: let default or execCommand handle
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
