import type { Block, BlockNoteEditor } from "@blocknote/core";
import { SideMenuExtension } from "@blocknote/core/extensions";

export function getLocalNoteSideMenuOffset(block: Block): number {
  if (block.type === "heading") {
    const level = (block.props as { level?: number })?.level ?? 1;
    switch (level) {
      case 1:
        return 7;
      case 2:
        return 4;
      case 3:
        return 2;
      case 4:
        return 1;
      case 5:
      case 6:
        return 0;
      default:
        return 2;
    }
  }
  if (block.type === "paragraph") return 4;
  if (
    block.type === "bulletListItem" ||
    block.type === "numberedListItem" ||
    block.type === "checkListItem"
  ) {
    return 4;
  }
  if (block.type === "quote") return 6;
  if (block.type === "codeBlock") return 6;
  if ((block.type as string) === "callout") return 12;
  if (block.type === "divider") return 6;
  return 4;
}

export function resolveTargetBlock(
  event: MouseEvent,
  editor: BlockNoteEditor,
  editorRoot: HTMLElement | null,
): Block | null {
  const target = event.target as HTMLElement | null;

  // 1. Check if the click/right-click originated on the side menu or its drag handles
  const isSideMenu = target?.closest<HTMLElement>(
    ".bn-side-menu, .bn-drag-handle, [data-test='dragHandle'], [data-test='dragHandleAdd'], [data-test='drag-handle']",
  );
  if (isSideMenu) {
    try {
      const ext = editor.getExtension(SideMenuExtension) as
        | { store?: { state?: { block?: Block; show?: boolean } } }
        | undefined;
      const sideMenuState = ext?.store?.state;
      if (sideMenuState?.block) {
        return sideMenuState.block;
      }
    } catch {
      // Fallback to spatial and DOM lookup
    }
  }

  // 2. Check direct DOM ancestor with data-id (e.g. text or block container)
  if (target) {
    const blockElement = target.closest<HTMLElement>("[data-id]");
    const blockId = blockElement?.getAttribute("data-id");
    if (blockId) {
      const block = editor.getBlock(blockId);
      if (block) return block as Block;
    }
  }

  if (!editorRoot) {
    return (
      (editor.getTextCursorPosition?.()?.block as Block | undefined) ??
      (editor.document[0] as Block | undefined) ??
      null
    );
  }

  // 3. Check elements from point across horizontal offsets within the editor content
  const rootRect = editorRoot.getBoundingClientRect();
  const probeXs = [
    event.clientX,
    rootRect.left + 40,
    rootRect.left + 120,
    rootRect.left + 240,
  ];

  for (const px of probeXs) {
    if (px < 0 || px > window.innerWidth) continue;
    const elements = document.elementsFromPoint(px, event.clientY);
    for (const el of elements) {
      if (el instanceof HTMLElement && editorRoot.contains(el)) {
        const blockElement = el.closest<HTMLElement>("[data-id]");
        const blockId = blockElement?.getAttribute("data-id");
        if (blockId) {
          const block = editor.getBlock(blockId);
          if (block) return block as Block;
        }
      }
    }
  }

  // 4. Bounding box fallback: find block element whose vertical bounds enclose event.clientY
  const blockElements = Array.from(
    editorRoot.querySelectorAll<HTMLElement>("[data-id]"),
  );

  let closestBlock: Block | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const el of blockElements) {
    const bRect = el.getBoundingClientRect();
    if (event.clientY >= bRect.top && event.clientY <= bRect.bottom) {
      const blockId = el.getAttribute("data-id");
      if (blockId) {
        const block = editor.getBlock(blockId);
        if (block) return block as Block;
      }
    }

    const centerY = bRect.top + bRect.height / 2;
    const dist = Math.abs(centerY - event.clientY);
    if (dist < minDistance) {
      minDistance = dist;
      const blockId = el.getAttribute("data-id");
      if (blockId) {
        const block = editor.getBlock(blockId);
        if (block) closestBlock = block as Block;
      }
    }
  }

  if (closestBlock) {
    return closestBlock;
  }

  // 5. Final fallback to active cursor position or first block
  return (
    (editor.getTextCursorPosition?.()?.block as Block | undefined) ??
    (editor.document[0] as Block | undefined) ??
    null
  );
}
