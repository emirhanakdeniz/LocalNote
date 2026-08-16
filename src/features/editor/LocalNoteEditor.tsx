import type { Block, PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { useEffect, useRef, useState } from "react";
import type { SpellcheckPreference } from "../settings/api";
import type { SaveStatus } from "./types";
import type {
  ExportStatus,
  MarkdownSerializer,
} from "../export/useMarkdownExport";
import { serializeMarkdown } from "../export/markdownSerialization";
import { BlockContextMenu } from "./BlockContextMenu";
import { duplicateActiveBlock, handleEditorPaste } from "./clipboard";
import { localNoteSchema } from "./codeBlock";
import { CodeLanguagePickers } from "./CodeLanguagePicker";
import { EditorHeader } from "./EditorHeader";
import { LocalNoteSideMenu } from "./LocalNoteSideMenu";
import { resolveTargetBlock } from "./targetBlockResolver";
import { TableOfContents } from "./TableOfContents";
import { useTocState } from "./useTocState";
import "./local-note-editor.css";

type ResolvedTheme = "light" | "dark";

function resolveTheme(): ResolvedTheme {
  const explicitTheme = document.documentElement.dataset.theme;

  if (explicitTheme === "light" || explicitTheme === "dark") {
    return explicitTheme;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function useResolvedTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>(resolveTheme);

  useEffect(() => {
    const colorScheme = window.matchMedia?.("(prefers-color-scheme: dark)");
    const updateTheme = () => setTheme(resolveTheme());
    const observer = new MutationObserver(updateTheme);

    colorScheme?.addEventListener("change", updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      colorScheme?.removeEventListener("change", updateTheme);
      observer.disconnect();
    };
  }, []);

  return theme;
}

type LocalNoteEditorProps = {
  pageId: string;
  title: string;
  initialBlocks: PartialBlock[];
  saveStatus: SaveStatus;
  saveError: string | null;
  onChange: (pageId: string, blocks: PartialBlock[]) => void;
  onRetrySave: () => void;
  exportStatus: ExportStatus;
  exportError: string | null;
  onExport: (serialize: MarkdownSerializer) => void;
  spellcheck: SpellcheckPreference;
  isFavorite: boolean;
  onSetFavorite: (isFavorite: boolean) => void;
  onCreateChild: () => void;
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
};

export function LocalNoteEditor({
  pageId,
  title,
  initialBlocks,
  saveStatus,
  saveError,
  onChange,
  onRetrySave,
  exportStatus,
  exportError,
  onExport,
  spellcheck,
  isFavorite,
  onSetFavorite,
  onCreateChild,
  isFocusMode = false,
  onToggleFocusMode,
}: LocalNoteEditorProps) {
  const editorRootRef = useRef<HTMLElement>(null);
  const [editorRoot, setEditorRoot] = useState<HTMLElement | null>(null);
  const tocState = useTocState();
  const theme = useResolvedTheme();
  const editor = useCreateBlockNote({
    schema: localNoteSchema,
    initialContent: initialBlocks.length ? initialBlocks : undefined,
  });

  useEffect(() => {
    setEditorRoot(editorRootRef.current);
  }, []);

  useEffect(() => {
    if (!editorRoot) return;
    const applySpellcheck = () => {
      editorRoot
        .querySelectorAll<HTMLElement>(
          '.bn-block-content[data-content-type="codeBlock"], .bn-block-content[data-content-type="codeBlock"] *, .bn-inline-content code',
        )
        .forEach((element) => (element.spellcheck = false));
    };
    applySpellcheck();
    const observer = new MutationObserver(applySpellcheck);
    observer.observe(editorRoot, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [editorRoot]);

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number } | null;
    targetBlock: Block | null;
  }>({
    isOpen: false,
    position: null,
    targetBlock: null,
  });

  useEffect(() => {
    if (!editorRoot) return;
    const onPaste = (event: ClipboardEvent) => {
      void handleEditorPaste(event, editor);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateActiveBlock(editor);
      }
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      const block = resolveTargetBlock(event, editor, editorRoot);

      if (block) {
        try {
          editor.setTextCursorPosition?.(block.id, "end");
        } catch {
          // Ignore
        }
        setContextMenu({
          isOpen: true,
          position: { x: event.clientX, y: event.clientY },
          targetBlock: block,
        });
      }
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const dragHandle = target?.closest<HTMLElement>(
        ".bn-drag-handle, [data-test='dragHandle'], [data-test='drag-handle'], .bn-side-menu button, .bn-side-menu",
      );
      if (dragHandle) {
        const isAddButton = target?.closest<HTMLElement>(
          "[data-test='dragHandleAdd'], [data-test='add-block']",
        );
        if (isAddButton) {
          return;
        }

        const rect = dragHandle.getBoundingClientRect();
        const block = resolveTargetBlock(event, editor, editorRoot);

        if (block) {
          event.preventDefault();
          event.stopPropagation();
          try {
            editor.setTextCursorPosition?.(block.id, "end");
          } catch {
            // Ignore
          }
          setContextMenu({
            isOpen: true,
            position: { x: rect.right + 4, y: rect.top },
            targetBlock: block,
          });
        }
      }
    };

    editorRoot.addEventListener("paste", onPaste, true);
    editorRoot.addEventListener("keydown", onKeyDown);
    editorRoot.addEventListener("contextmenu", onContextMenu);
    editorRoot.addEventListener("click", onClick, true);
    return () => {
      editorRoot.removeEventListener("paste", onPaste, true);
      editorRoot.removeEventListener("keydown", onKeyDown);
      editorRoot.removeEventListener("contextmenu", onContextMenu);
      editorRoot.removeEventListener("click", onClick, true);
    };
  }, [editor, editorRoot]);

  const handleContainerClick = (event: React.MouseEvent<HTMLElement>) => {
    if (
      event.target === event.currentTarget ||
      (event.target instanceof HTMLElement &&
        (event.target.classList.contains("content-area") ||
          event.target.classList.contains("document") ||
          event.target.classList.contains("localnote-editor")))
    ) {
      editor.focus?.();
    }
  };

  const serializeMarkdownFn = () => (blocks: PartialBlock[]) =>
    serializeMarkdown(blocks, (document) =>
      editor.blocksToMarkdownLossy(document),
    );

  const documentBlocks = editor.document as PartialBlock[];

  return (
    <div
      className={`editor-view-container${isFocusMode ? " editor-view-container--focus-mode" : ""}${tocState.isResizing ? " editor-view-container--resizing" : ""}`}
    >
      <main className="content-area" onClick={handleContainerClick}>
        <article className="document" onClick={handleContainerClick}>
          <EditorHeader
            title={title}
            saveStatus={saveStatus}
            saveError={saveError}
            onRetrySave={onRetrySave}
            exportStatus={exportStatus}
            exportError={exportError}
            onExport={onExport}
            serializeMarkdownFn={serializeMarkdownFn}
            isFavorite={isFavorite}
            onSetFavorite={onSetFavorite}
            onCreateChild={onCreateChild}
            blocks={documentBlocks}
            isFocusMode={isFocusMode}
            onToggleFocusMode={onToggleFocusMode}
            isTocVisible={tocState.isVisible}
            onToggleToc={tocState.toggleVisible}
          />

          <section
            ref={editorRootRef}
            className="localnote-editor"
            aria-label="Block editor"
          >
            <BlockNoteView
              editor={editor}
              theme={theme}
              spellCheck={spellcheck === "system"}
              onChange={() => onChange(pageId, editor.document as PartialBlock[])}
              sideMenu={false}
            >
              <LocalNoteSideMenu />
            </BlockNoteView>
            <CodeLanguagePickers root={editorRoot} />
            <BlockContextMenu
              isOpen={contextMenu.isOpen}
              position={contextMenu.position}
              targetBlock={contextMenu.targetBlock}
              editor={editor}
              onClose={() =>
                setContextMenu({
                  isOpen: false,
                  position: null,
                  targetBlock: null,
                })
              }
            />
          </section>
        </article>
      </main>

      {!isFocusMode && tocState.isVisible && (
        <TableOfContents
          blocks={documentBlocks}
          editorRoot={editorRoot}
          isVisible={tocState.isVisible}
          onToggleVisible={tocState.toggleVisible}
          width={tocState.width}
          onResizerPointerDown={tocState.handleResizerPointerDown}
          onResizerDoubleClick={tocState.handleResizerDoubleClick}
        />
      )}
    </div>
  );
}
