import { describe, expect, it, vi } from "vitest";
import type { Block, BlockNoteEditor } from "@blocknote/core";
import { SideMenuExtension } from "@blocknote/core/extensions";
import {
  getLocalNoteSideMenuOffset,
  resolveTargetBlock,
} from "./targetBlockResolver";

describe("LocalNoteSideMenu offsets", () => {
  it("returns calibrated offsets for heading levels", () => {
    const h1 = { id: "1", type: "heading", props: { level: 1 } } as unknown as Block;
    const h2 = { id: "2", type: "heading", props: { level: 2 } } as unknown as Block;
    const h3 = { id: "3", type: "heading", props: { level: 3 } } as unknown as Block;
    const h4 = { id: "4", type: "heading", props: { level: 4 } } as unknown as Block;
    const h5 = { id: "5", type: "heading", props: { level: 5 } } as unknown as Block;
    const h6 = { id: "6", type: "heading", props: { level: 6 } } as unknown as Block;

    expect(getLocalNoteSideMenuOffset(h1)).toBe(7);
    expect(getLocalNoteSideMenuOffset(h2)).toBe(4);
    expect(getLocalNoteSideMenuOffset(h3)).toBe(2);
    expect(getLocalNoteSideMenuOffset(h4)).toBe(1);
    expect(getLocalNoteSideMenuOffset(h5)).toBe(0);
    expect(getLocalNoteSideMenuOffset(h6)).toBe(0);
  });

  it("returns proper offsets for prose, lists, and code blocks", () => {
    const paragraph = { id: "p1", type: "paragraph", props: {} } as unknown as Block;
    const bullet = { id: "b1", type: "bulletListItem", props: {} } as unknown as Block;
    const numbered = { id: "n1", type: "numberedListItem", props: {} } as unknown as Block;
    const check = { id: "c1", type: "checkListItem", props: {} } as unknown as Block;
    const quote = { id: "q1", type: "quote", props: {} } as unknown as Block;
    const code = { id: "cd1", type: "codeBlock", props: {} } as unknown as Block;
    const callout = { id: "cl1", type: "callout", props: {} } as unknown as Block;
    const divider = { id: "d1", type: "divider", props: {} } as unknown as Block;

    expect(getLocalNoteSideMenuOffset(paragraph)).toBe(4);
    expect(getLocalNoteSideMenuOffset(bullet)).toBe(4);
    expect(getLocalNoteSideMenuOffset(numbered)).toBe(4);
    expect(getLocalNoteSideMenuOffset(check)).toBe(4);
    expect(getLocalNoteSideMenuOffset(quote)).toBe(6);
    expect(getLocalNoteSideMenuOffset(code)).toBe(6);
    expect(getLocalNoteSideMenuOffset(callout)).toBe(12);
    expect(getLocalNoteSideMenuOffset(divider)).toBe(6);
  });
});

describe("resolveTargetBlock", () => {
  it("resolves target block from side menu state when clicking/right-clicking side menu elements", () => {
    const hoveredBlock = { id: "block-hovered", type: "heading", props: { level: 1 } } as unknown as Block;
    const cursorBlock = { id: "block-cursor", type: "paragraph", props: {} } as unknown as Block;

    const mockEditor = {
      getExtension: vi.fn().mockImplementation((ext) => {
        if (ext === SideMenuExtension) {
          return {
            store: {
              state: {
                show: true,
                block: hoveredBlock,
              },
            },
          };
        }
        return undefined;
      }),
      getBlock: vi.fn().mockImplementation((id: string) => {
        if (id === hoveredBlock.id) return hoveredBlock;
        if (id === cursorBlock.id) return cursorBlock;
        return undefined;
      }),
      getTextCursorPosition: vi.fn().mockReturnValue({ block: cursorBlock }),
      document: [cursorBlock, hoveredBlock],
    } as unknown as BlockNoteEditor;

    const sideMenuButton = document.createElement("button");
    sideMenuButton.className = "bn-drag-handle";
    sideMenuButton.setAttribute("data-test", "dragHandle");

    const event = {
      target: sideMenuButton,
      clientX: 50,
      clientY: 100,
    } as unknown as MouseEvent;

    const resolved = resolveTargetBlock(event, mockEditor, null);
    expect(resolved).toBe(hoveredBlock);
    expect(resolved?.id).toBe("block-hovered");
  });

  it("resolves target block from DOM ancestor with data-id", () => {
    const targetBlock = { id: "block-dom", type: "paragraph", props: {} } as unknown as Block;
    const cursorBlock = { id: "block-cursor", type: "paragraph", props: {} } as unknown as Block;

    const mockEditor = {
      getExtension: vi.fn().mockReturnValue(undefined),
      getBlock: vi.fn().mockImplementation((id: string) => {
        if (id === "block-dom") return targetBlock;
        return undefined;
      }),
      getTextCursorPosition: vi.fn().mockReturnValue({ block: cursorBlock }),
      document: [cursorBlock, targetBlock],
    } as unknown as BlockNoteEditor;

    const container = document.createElement("div");
    container.setAttribute("data-id", "block-dom");
    const textSpan = document.createElement("span");
    container.appendChild(textSpan);

    const event = {
      target: textSpan,
      clientX: 100,
      clientY: 200,
    } as unknown as MouseEvent;

    const resolved = resolveTargetBlock(event, mockEditor, container);
    expect(resolved).toBe(targetBlock);
  });

  it("falls back to text cursor position if no block element is matched", () => {
    const cursorBlock = { id: "block-cursor", type: "paragraph", props: {} } as unknown as Block;

    const mockEditor = {
      getExtension: vi.fn().mockReturnValue(undefined),
      getBlock: vi.fn().mockReturnValue(undefined),
      getTextCursorPosition: vi.fn().mockReturnValue({ block: cursorBlock }),
      document: [cursorBlock],
    } as unknown as BlockNoteEditor;

    const event = {
      target: document.createElement("div"),
      clientX: 0,
      clientY: 0,
    } as unknown as MouseEvent;

    const resolved = resolveTargetBlock(event, mockEditor, null);
    expect(resolved).toBe(cursorBlock);
  });
});
