import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Page } from "./features/pages/types";
import { localNoteSchema } from "./features/editor/codeBlock";
import App from "./App";

const invokeMock = vi.hoisted(() => vi.fn());
const destroyMock = vi.hoisted(() => vi.fn());
const closeMock = vi.hoisted(() => vi.fn());
const minimizeMock = vi.hoisted(() => vi.fn());
const toggleMaximizeMock = vi.hoisted(() => vi.fn());
const markdownSerializerMock = vi.hoisted(() => vi.fn());
const editorOptionsMock = vi.hoisted(() => vi.fn());
const clipboardWriteMock = vi.hoisted(() => vi.fn());
const closeHandler = vi.hoisted(() => ({
  current: null as null | ((event: { preventDefault: () => void }) => Promise<void>),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    close: closeMock,
    destroy: destroyMock,
    minimize: minimizeMock,
    toggleMaximize: toggleMaximizeMock,
    onCloseRequested: vi.fn(async (handler) => {
      closeHandler.current = handler;
      return () => undefined;
    }),
  }),
}));
vi.mock("@blocknote/react", () => ({
  useCreateBlockNote: (options: { initialContent?: unknown[]; schema?: unknown }) => {
    editorOptionsMock(options);
    return {
      document: options.initialContent?.length
        ? options.initialContent
        : [{ type: "paragraph" }],
      blocksToMarkdownLossy: markdownSerializerMock,
    };
  },
}));
vi.mock("@blocknote/mantine", () => ({
  BlockNoteView: ({
    editor,
    onChange,
    spellCheck,
  }: {
    editor: { document: unknown[] };
    onChange?: () => void;
    spellCheck?: boolean;
  }) => (
    <div>
      <div
        role="textbox"
        aria-label="BlockNote editing surface"
        data-document={JSON.stringify(editor.document)}
        spellCheck={spellCheck}
      />
      <div className="bn-block-content" data-content-type="codeBlock">
        <div>
          <select aria-label="Native code language" defaultValue="text">
            <option value="text">Plain text</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
          </select>
        </div>
        <pre><code>const misspelledCode = true;</code></pre>
      </div>
      <div className="bn-inline-content"><code>inlineIdentifier</code></div>
      <button
        type="button"
        aria-label="Simulate editor change"
        onClick={(event) => {
          editor.document = [{ type: "paragraph", content: "Edited content" }];
          event.currentTarget.parentElement
            ?.querySelector('[role="textbox"]')
            ?.setAttribute("data-document", JSON.stringify(editor.document));
          onChange?.();
        }}
      >
        Edit
      </button>
    </div>
  ),
}));

function page(
  id: string,
  title: string,
  parentId: string | null = null,
  position = 0,
): Page {
  return {
    id,
    title,
    parentId,
    position,
    isFavorite: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt: null,
  };
}

function openPageActions(title: string) {
  fireEvent.click(screen.getByRole("button", { name: `Actions for ${title}` }));
  return screen.getByRole("menu", { name: `Actions for ${title}` });
}

function mockPageCommands(
  initialPages: Page[],
  initialDocuments: Record<string, string | null> = {},
) {
  let pages = [...initialPages];
  let trashed: Page[] = [];
  const documents = { ...initialDocuments };
  invokeMock.mockImplementation(
    (command: string, argumentsValue?: Record<string, unknown>) => {
      const args = argumentsValue ?? {};
      if (command === "list_pages") return Promise.resolve([...pages]);
      if (command === "list_trash") return Promise.resolve([...trashed]);
      if (command === "open_page") {
        const opened = pages.find((candidate) => candidate.id === args.id)!;
        opened.lastOpenedAt = "2026-01-01T00:01:00.000Z";
        return Promise.resolve({ ...opened });
      }
      if (command === "create_page") {
        const parentId = (args.parentId as string | null) ?? null;
        const created = page(
          `page-${pages.length + trashed.length + 1}`,
          "Untitled",
          parentId,
          pages.filter((candidate) => candidate.parentId === parentId).length,
        );
        pages.push(created);
        return Promise.resolve({ ...created });
      }
      if (command === "rename_page") {
        const renamed = pages.find((candidate) => candidate.id === args.id)!;
        renamed.title = String(args.title).trim() || "Untitled";
        return Promise.resolve({ ...renamed });
      }
      if (command === "set_page_favorite") {
        const updated = pages.find((candidate) => candidate.id === args.id)!;
        updated.isFavorite = Boolean(args.isFavorite);
        return Promise.resolve({ ...updated });
      }
      if (command === "delete_page") {
        const deleted = pages.find((candidate) => candidate.id === args.id);
        if (deleted) {
          deleted.deletedAt = "2026-01-01T00:02:00.000Z";
          trashed.push(deleted);
        }
        pages = pages.filter((candidate) => candidate.id !== args.id);
        return Promise.resolve([...pages]);
      }
      if (command === "restore_page") {
        const restored = trashed.find((candidate) => candidate.id === args.id);
        if (restored) {
          restored.deletedAt = null;
          trashed = trashed.filter((candidate) => candidate.id !== args.id);
          pages.push(restored);
        }
        return Promise.resolve([...pages]);
      }
      if (command === "delete_page_permanently") {
        trashed = trashed.filter((candidate) => candidate.id !== args.id);
        delete documents[String(args.id)];
        return Promise.resolve([...trashed]);
      }
      if (command === "empty_trash") {
        trashed = [];
        return Promise.resolve();
      }
      if (command === "move_page") return Promise.resolve([...pages]);
      if (command === "load_document") {
        const pageId = String(args.pageId);
        return Promise.resolve({
          pageId,
          contentJson: documents[pageId] ?? null,
          updatedAt: documents[pageId] ? "2026-01-01T00:00:00.000Z" : null,
        });
      }
      if (command === "save_document") {
        const pageId = String(args.pageId);
        documents[pageId] = String(args.contentJson);
        return Promise.resolve({
          pageId,
          contentJson: documents[pageId],
          updatedAt: "2026-01-01T00:01:00.000Z",
        });
      }
      if (command === "search_pages") {
        const query = String(args.query).trim().toLowerCase();
        if (!query) return Promise.resolve([]);
        return Promise.resolve(
          pages
            .filter(
              (candidate) =>
                candidate.title.toLowerCase().includes(query) ||
                (documents[candidate.id] ?? "").toLowerCase().includes(query),
            )
            .map((candidate) => ({
              pageId: candidate.id,
              title: candidate.title,
              snippet: documents[candidate.id]?.toLowerCase().includes(query)
                ? "Matching note text"
                : "",
            })),
        );
      }
      if (command === "export_markdown") {
        return Promise.resolve({ exported: true });
      }
      if (command === "get_theme") return Promise.resolve("system");
      if (command === "set_theme") return Promise.resolve(args.preference);
      if (command === "get_accent_color") return Promise.resolve("#4c1d95");
      if (command === "set_accent_color") return Promise.resolve(args.hex);
      if (command === "get_spellcheck") return Promise.resolve("system");
      if (command === "set_spellcheck") return Promise.resolve(args.preference);
      throw new Error(`Unexpected command: ${command}`);
    },
  );
}

describe("LocalNote page management", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    destroyMock.mockReset();
    destroyMock.mockResolvedValue(undefined);
    closeMock.mockReset();
    minimizeMock.mockReset();
    toggleMaximizeMock.mockReset();
    closeHandler.current = null;
    editorOptionsMock.mockReset();
    markdownSerializerMock.mockReset();
    markdownSerializerMock.mockImplementation(
      (blocks) => `markdown:${JSON.stringify(blocks)}`,
    );
    clipboardWriteMock.mockReset();
    clipboardWriteMock.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteMock },
    });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.accent;
  });

  it("shows a calm empty state when the database has no pages", async () => {
    mockPageCommands([]);
    render(<App />);

    expect(await screen.findByRole("heading", { name: "No pages yet" })).toBeVisible();
    expect(screen.getByRole("button", { name: "New page" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Open settings" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "About LocalNote" })).not.toBeInTheDocument();
    expect(screen.getByText("No favorites yet")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Recent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /BlockNote/i })).not.toBeInTheDocument();
  });

  it("mounts the editor with the LocalNote code-block schema", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);

    await screen.findByRole("heading", { name: "Alpha" });
    expect(editorOptionsMock).toHaveBeenCalledWith(
      expect.objectContaining({ schema: localNoteSchema }),
    );
  });

  it("opens Settings and persists explicit theme and spellcheck preferences", async () => {
    mockPageCommands([]);
    render(<App />);
    await screen.findByRole("heading", { name: "No pages yet" });

    const settingsTrigger = screen.getByRole("button", { name: "Open settings" });
    fireEvent.click(settingsTrigger);
    const dialog = screen.getByRole("dialog", { name: "Settings" });

    // Verify Settings content including About section
    expect(within(dialog).getByRole("heading", { name: "Settings" })).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "Appearance" })).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "Editor" })).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "About" })).toBeVisible();
    expect(within(dialog).getByText("Version 0.1.0")).toBeVisible();
    expect(within(dialog).getByText(/stored only on this device/i)).toBeVisible();

    fireEvent.click(within(dialog).getByRole("radio", { name: "Light" }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
    expect(invokeMock).toHaveBeenCalledWith("set_theme", { preference: "light" });

    fireEvent.click(within(dialog).getByRole("radio", { name: "Off" }));
    expect(invokeMock).toHaveBeenCalledWith("set_spellcheck", { preference: "off" });

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
    expect(settingsTrigger).toHaveFocus();
  });

  it("opens Settings and selects accent color presets and custom hex", async () => {
    mockPageCommands([]);
    render(<App />);
    await screen.findByRole("heading", { name: "No pages yet" });

    const settingsTrigger = screen.getByRole("button", { name: "Open settings" });
    fireEvent.click(settingsTrigger);
    const dialog = screen.getByRole("dialog", { name: "Settings" });

    // Preset selection: Emerald Forest (#14532d)
    const emeraldSwatch = within(dialog).getByRole("radio", { name: "Emerald Forest" });
    fireEvent.click(emeraldSwatch);
    await waitFor(() => expect(document.documentElement.dataset.accent).toBe("#14532d"));
    expect(invokeMock).toHaveBeenCalledWith("set_accent_color", { hex: "#14532d" });

    // Custom Hex input
    const hexInput = within(dialog).getByLabelText("Custom hex color code");
    fireEvent.change(hexInput, { target: { value: "#0F4C5C" } });
    await waitFor(() => expect(document.documentElement.dataset.accent).toBe("#0f4c5c"));
    expect(invokeMock).toHaveBeenCalledWith("set_accent_color", { hex: "#0f4c5c" });
  });

  it("applies prose spellcheck while excluding code blocks and inline code", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "BlockNote editing surface" });
    expect(editor).toHaveAttribute("spellcheck", "true");
    const codeBlock = document.querySelector<HTMLElement>('[data-content-type="codeBlock"]')!;
    const inlineCode = document.querySelector<HTMLElement>(".bn-inline-content code")!;
    await waitFor(() => {
      expect(codeBlock.spellcheck).toBe(false);
      expect(inlineCode.spellcheck).toBe(false);
    });
  });

  it("filters and selects a code language with the keyboard while preserving the active value", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });

    const trigger = await screen.findByRole("button", { name: "Code language: Plain text" });
    fireEvent.click(trigger);
    const search = screen.getByRole("searchbox", { name: "Search code languages" });
    await waitFor(() => expect(search).toHaveFocus());
    expect(screen.getByRole("listbox", { name: "Code languages" }).parentElement?.parentElement)
      .toBe(document.body);
    fireEvent.change(search, { target: { value: "type" } });
    expect(screen.getByRole("option", { name: "TypeScript" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "Python" })).not.toBeInTheDocument();
    const nativeSelect = document.querySelector<HTMLSelectElement>(
      'select[aria-label="Native code language"]',
    )!;
    nativeSelect.addEventListener("change", () => {
      const replacement = nativeSelect.cloneNode(true) as HTMLSelectElement;
      replacement.value = nativeSelect.value;
      nativeSelect.replaceWith(replacement);
    }, { once: true });
    fireEvent.keyDown(search, { key: "Enter" });

    const updatedTrigger = screen.getByRole("button", { name: "Code language: TypeScript" });
    await waitFor(() => expect(updatedTrigger).toHaveFocus());
    expect(document.querySelector('select[aria-label="Native code language"]'))
      .toHaveValue("typescript");

    fireEvent.click(updatedTrigger);
    expect(screen.getByRole("option", { name: "TypeScript" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("dismisses the code-language picker with Escape and restores trigger focus", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    const trigger = await screen.findByRole("button", { name: "Code language: Plain text" });
    fireEvent.click(trigger);
    const search = screen.getByRole("searchbox", { name: "Search code languages" });
    fireEvent.keyDown(search, { key: "Escape" });

    expect(screen.queryByRole("listbox", { name: "Code languages" })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("copies only the current code block text without changing the document", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    const editor = await screen.findByRole("textbox", { name: "BlockNote editing surface" });
    const originalDocument = editor.getAttribute("data-document");

    fireEvent.click(await screen.findByRole("button", { name: "Copy code" }));

    await waitFor(() => expect(clipboardWriteMock).toHaveBeenCalledWith(
      "const misspelledCode = true;",
    ));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeVisible();
    expect(editor).toHaveAttribute("data-document", originalDocument);
  });

  it("offers bounded active-page actions from the page header", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });

    const trigger = screen.getByRole("button", { name: "Page actions" });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu", { name: "Page actions" });
    const favorite = within(menu).getByRole("menuitem", { name: "Add to favorites" });
    await waitFor(() => expect(favorite).toHaveFocus());
    fireEvent.click(favorite);

    expect(invokeMock).toHaveBeenCalledWith("set_page_favorite", {
      id: "alpha",
      isFavorite: true,
    });
  });

  it("supports keyboard navigation and focus restoration in page action menus", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });

    const trigger = screen.getByRole("button", { name: "Actions for Alpha" });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu", { name: "Actions for Alpha" });
    const favorite = within(menu).getByRole("menuitem", { name: "Add to favorites" });
    await waitFor(() => expect(favorite).toHaveFocus());

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(within(menu).getByRole("menuitem", { name: "Rename" })).toHaveFocus();
    fireEvent.keyDown(menu, { key: "End" });
    expect(within(menu).getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    fireEvent.keyDown(menu, { key: "Escape" });

    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("menu", { name: "Actions for Alpha" }))
      .not.toBeInTheDocument();
  });

  it("renders the real hierarchy and selects a page", async () => {
    mockPageCommands([
      page("root", "Projects"),
      page("second", "Journal", null, 1),
      page("child", "LocalNote", "root"),
    ]);
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Projects" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "LocalNote" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand Projects" }));
    expect(screen.getByRole("button", { name: "LocalNote" })).toBeVisible();

    const pageTree = screen.getByRole("region", { name: "Pages" });
    fireEvent.click(within(pageTree).getByRole("button", { name: "Journal" }));
    expect(await screen.findByRole("heading", { name: "Journal" })).toBeVisible();
    expect(within(pageTree).getByRole("button", { name: "Journal" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("loads independent documents when selecting different pages", async () => {
    mockPageCommands(
      [page("alpha", "Alpha"), page("beta", "Beta", null, 1)],
      {
        alpha: JSON.stringify([{ type: "paragraph", content: "Alpha body" }]),
        beta: JSON.stringify([{ type: "paragraph", content: "Beta body" }]),
      },
    );
    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "BlockNote editing surface" });
    expect(editor).toHaveAttribute("data-document", expect.stringContaining("Alpha body"));

    fireEvent.click(screen.getByRole("button", { name: "Beta" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "BlockNote editing surface" }))
        .toHaveAttribute("data-document", expect.stringContaining("Beta body")),
    );
  });

  it("flushes the previous page before completing a page switch", async () => {
    mockPageCommands([page("alpha", "Alpha"), page("beta", "Beta", null, 1)]);
    render(<App />);
    await screen.findByRole("textbox", { name: "BlockNote editing surface" });

    fireEvent.click(screen.getByRole("button", { name: "Simulate editor change" }));
    fireEvent.click(screen.getByRole("button", { name: "Beta" }));

    await screen.findByRole("heading", { name: "Beta" });
    const saveIndex = invokeMock.mock.calls.findIndex(
      ([command, args]) => command === "save_document" && args.pageId === "alpha",
    );
    const betaLoadIndex = invokeMock.mock.calls.findIndex(
      ([command, args]) => command === "load_document" && args.pageId === "beta",
    );
    expect(saveIndex).toBeGreaterThan(-1);
    expect(betaLoadIndex).toBeGreaterThan(saveIndex);
  });

  it("debounces autosave and reports the save status", async () => {
    vi.useFakeTimers();
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    await vi.waitFor(() =>
      expect(screen.getByRole("textbox", { name: "BlockNote editing surface" })).toBeVisible(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Simulate editor change" }));
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
    await vi.advanceTimersByTimeAsync(499);
    expect(invokeMock).not.toHaveBeenCalledWith("save_document", expect.anything());
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
    expect(invokeMock).toHaveBeenCalledWith(
      "save_document",
      expect.objectContaining({ pageId: "alpha" }),
    );
    vi.useRealTimers();
  });

  it("keeps editor content in memory and exposes retry when saving fails", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    const implementation = invokeMock.getMockImplementation()!;
    invokeMock.mockImplementation((command, args) =>
      command === "save_document"
        ? Promise.reject(new Error("disk unavailable"))
        : implementation(command, args),
    );
    render(<App />);
    await screen.findByRole("textbox", { name: "BlockNote editing surface" });

    fireEvent.click(screen.getByRole("button", { name: "Simulate editor change" }));
    await waitFor(
      () => expect(screen.getByRole("status")).toHaveTextContent("Save failed"),
      { timeout: 1500 },
    );
    expect(screen.getByRole("textbox", { name: "BlockNote editing surface" }))
      .toHaveAttribute("data-document", expect.stringContaining("Edited content"));
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  it("preserves malformed stored JSON without triggering an empty autosave", async () => {
    mockPageCommands([page("alpha", "Alpha")], { alpha: "{malformed" });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Note unavailable" })).toBeVisible();
    expect(screen.getByText(/original data has been preserved/i)).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 550));
    expect(invokeMock).not.toHaveBeenCalledWith("save_document", expect.anything());
  });

  it("flushes pending edits before the native window is destroyed", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    await screen.findByRole("textbox", { name: "BlockNote editing surface" });
    fireEvent.click(screen.getByRole("button", { name: "Simulate editor change" }));

    const preventDefault = vi.fn();
    await closeHandler.current?.({ preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(invokeMock).toHaveBeenCalledWith(
      "save_document",
      expect.objectContaining({ pageId: "alpha" }),
    );
    expect(destroyMock).toHaveBeenCalledOnce();
  });

  it("keeps the native window open when its close-time save fails", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    const implementation = invokeMock.getMockImplementation()!;
    invokeMock.mockImplementation((command, args) =>
      command === "save_document"
        ? Promise.reject(new Error("close save failed"))
        : implementation(command, args),
    );
    render(<App />);
    await screen.findByRole("textbox", { name: "BlockNote editing surface" });
    fireEvent.click(screen.getByRole("button", { name: "Simulate editor change" }));

    const preventDefault = vi.fn();
    await closeHandler.current?.({ preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(destroyMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Save failed"),
    );
  });

  it("reveals a persisted active page inside a collapsed hierarchy", async () => {
    const root = page("root", "Projects");
    const child = page("child", "LocalNote", "root");
    child.lastOpenedAt = "2026-01-01T00:02:00.000Z";
    mockPageCommands([root, child]);

    render(<App />);

    expect(await screen.findByRole("heading", { name: "LocalNote" })).toBeVisible();
    expect(
      await within(screen.getByRole("region", { name: "Pages" })).findByRole("button", {
        name: "LocalNote",
      }),
    ).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Collapse Projects" })).toBeVisible();
  });

  it("creates and selects a new root page", async () => {
    mockPageCommands([]);
    render(<App />);
    await screen.findByRole("heading", { name: "No pages yet" });

    fireEvent.click(screen.getByRole("button", { name: "New page" }));

    expect(await screen.findByRole("heading", { name: "Untitled" })).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "Pages" })).getByRole("button", {
        name: "Untitled",
      }),
    ).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(invokeMock).toHaveBeenCalledWith("create_page", { parentId: null });
  });

  it("renames the active page with the keyboard", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });

    fireEvent.click(within(openPageActions("Alpha")).getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Rename Alpha" });
    fireEvent.change(input, { target: { value: "  Renamed  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByRole("heading", { name: "Renamed" })).toBeVisible();
    expect(screen.queryByRole("textbox", { name: /Rename/ })).not.toBeInTheDocument();
  });

  it("cancels an inline rename with Escape", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });

    fireEvent.click(within(openPageActions("Alpha")).getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Rename Alpha" });
    fireEvent.change(input, { target: { value: "Discarded title" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.getByRole("button", { name: "Alpha" })).toBeVisible();
    expect(invokeMock).not.toHaveBeenCalledWith("rename_page", expect.anything());
  });

  it("requires deliberate delete confirmation", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });

    fireEvent.click(within(openPageActions("Alpha")).getByRole("menuitem", { name: "Delete" }));
    const confirmation = screen.getByRole("alertdialog");
    expect(confirmation).toHaveTextContent("Move \"Alpha\" to Trash?");
    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    fireEvent.click(within(openPageActions("Alpha")).getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Move to Trash" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "No pages yet" })).toBeVisible(),
    );
  });

  it("favorites and unfavorites a page and updates the Favorites section", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });
    const favorites = screen.getByRole("region", { name: "Favorites" });

    fireEvent.click(within(openPageActions("Alpha")).getByRole("menuitem", { name: "Add to favorites" }));
    expect(await within(favorites).findByRole("button", { name: "Alpha" })).toBeVisible();
    expect(invokeMock).toHaveBeenCalledWith("set_page_favorite", {
      id: "alpha",
      isFavorite: true,
    });

    fireEvent.click(within(openPageActions("Alpha")).getByRole("menuitem", { name: "Remove from favorites" }));
    await waitFor(() =>
      expect(within(favorites).queryByRole("button", { name: "Alpha" }))
        .not.toBeInTheDocument(),
    );
    expect(within(favorites).getByText("No favorites yet")).toBeVisible();
  });

  it("renders Favorites but not Recent from persisted page metadata", async () => {
    const alpha = page("alpha", "Alpha");
    alpha.isFavorite = true;
    alpha.lastOpenedAt = "2026-01-01T00:01:00.000Z";
    const beta = page("beta", "Beta", null, 1);
    beta.lastOpenedAt = "2026-01-01T00:03:00.000Z";
    const gamma = page("gamma", "Gamma", null, 2);
    gamma.lastOpenedAt = "2026-01-01T00:02:00.000Z";
    mockPageCommands([alpha, beta, gamma]);
    render(<App />);
    await screen.findByRole("heading", { name: "Beta" });

    expect(
      within(screen.getByRole("region", { name: "Favorites" })).getByRole("button", {
        name: "Alpha",
      }),
    ).toBeVisible();
    expect(screen.queryByRole("region", { name: "Recent" })).not.toBeInTheDocument();
  });

  it("uses the safe flush-before-load path from Favorites and Pages", async () => {
    const alpha = page("alpha", "Alpha");
    alpha.lastOpenedAt = "2026-01-01T00:01:00.000Z";
    const beta = page("beta", "Beta", null, 1);
    beta.isFavorite = true;
    mockPageCommands([alpha, beta]);
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });

    fireEvent.click(screen.getByRole("button", { name: "Simulate editor change" }));
    fireEvent.click(
      within(screen.getByRole("region", { name: "Favorites" })).getByRole("button", {
        name: "Beta",
      }),
    );
    await screen.findByRole("heading", { name: "Beta" });

    const alphaSaveIndex = invokeMock.mock.calls.findIndex(
      ([command, args]) => command === "save_document" && args.pageId === "alpha",
    );
    const betaLoadIndex = invokeMock.mock.calls.findIndex(
      ([command, args]) => command === "load_document" && args.pageId === "beta",
    );
    expect(alphaSaveIndex).toBeGreaterThan(-1);
    expect(betaLoadIndex).toBeGreaterThan(alphaSaveIndex);

    fireEvent.click(screen.getByRole("button", { name: "Simulate editor change" }));
    fireEvent.click(
      within(screen.getByRole("region", { name: "Pages" })).getByRole("button", {
        name: "Alpha",
      }),
    );
    await screen.findByRole("heading", { name: "Alpha" });
    const betaSaveIndex = invokeMock.mock.calls.findIndex(
      ([command, args]) => command === "save_document" && args.pageId === "beta",
    );
    const alphaLoads = invokeMock.mock.calls
      .map(([command, args], index) => ({ command, args, index }))
      .filter(({ command, args }) => command === "load_document" && args.pageId === "alpha");
    expect(betaSaveIndex).toBeGreaterThan(betaLoadIndex);
    expect(alphaLoads.at(-1)!.index).toBeGreaterThan(betaSaveIndex);
  });

  it("keeps renamed favorite and page-tree labels synchronized", async () => {
    const alpha = page("alpha", "Alpha");
    alpha.isFavorite = true;
    alpha.lastOpenedAt = "2026-01-01T00:01:00.000Z";
    mockPageCommands([alpha]);
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });

    fireEvent.click(within(openPageActions("Alpha")).getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", { name: "Rename Alpha" });
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(
      await within(screen.getByRole("region", { name: "Favorites" })).findByRole("button", {
        name: "Renamed",
      }),
    ).toBeVisible();
    expect(within(screen.getByRole("region", { name: "Pages" })).getByRole("button", {
      name: "Renamed",
    })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Recent" })).not.toBeInTheDocument();
  });

  it("removes a deleted page from Favorites without rendering Recent", async () => {
    const alpha = page("alpha", "Alpha");
    alpha.isFavorite = true;
    alpha.lastOpenedAt = "2026-01-01T00:01:00.000Z";
    mockPageCommands([alpha]);
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });

    fireEvent.click(within(openPageActions("Alpha")).getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Move to Trash" }),
    );

    await screen.findByRole("heading", { name: "No pages yet" });
    expect(screen.getByText("No favorites yet")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Recent" })).not.toBeInTheDocument();
  });

  it("opens quick search with Ctrl+P, focuses the input, and closes with Escape", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });

    fireEvent.keyDown(window, { key: "p", ctrlKey: true });
    const input = await screen.findByRole("searchbox", {
      name: "Search pages and notes",
    });
    await waitFor(() => expect(input).toHaveFocus());
    expect(screen.getByText("Search page titles and saved note text.")).toBeVisible();

    fireEvent.keyDown(window, { key: "p", ctrlKey: true });
    expect(screen.getByRole("dialog", { name: "Search notes" })).toBeVisible();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Search notes" })).not.toBeInTheDocument();
  });

  it("renders results, moves selection with arrows, and opens safely with Enter", async () => {
    mockPageCommands(
      [page("alpha", "Alpha note"), page("beta", "Beta note", null, 1)],
      { alpha: null, beta: JSON.stringify([{ type: "paragraph", content: "Beta body" }]) },
    );
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha note" });
    fireEvent.click(screen.getByRole("button", { name: "Simulate editor change" }));
    fireEvent.keyDown(window, { key: "p", ctrlKey: true });
    const input = await screen.findByRole("searchbox", { name: "Search pages and notes" });
    fireEvent.change(input, { target: { value: "note" } });

    const dialog = screen.getByRole("dialog", { name: "Search notes" });
    const alphaResult = await within(dialog).findByRole("button", { name: "Alpha note" });
    const betaResult = within(dialog).getByRole("button", { name: "Beta note" });
    expect(alphaResult).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(betaResult).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(alphaResult).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByRole("heading", { name: "Beta note" })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Search notes" })).not.toBeInTheDocument();
    const saveIndex = invokeMock.mock.calls.findIndex(
      ([command, args]) => command === "save_document" && args.pageId === "alpha",
    );
    const betaLoadIndex = invokeMock.mock.calls.findIndex(
      ([command, args]) => command === "load_document" && args.pageId === "beta",
    );
    expect(saveIndex).toBeGreaterThan(-1);
    expect(betaLoadIndex).toBeGreaterThan(saveIndex);
  });

  it("shows calm no-result and search-failure states", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });
    fireEvent.click(screen.getByRole("button", { name: "Search notes" }));
    const input = screen.getByRole("searchbox", { name: "Search pages and notes" });
    fireEvent.change(input, { target: { value: "missing" } });
    expect(await screen.findByText("No matching pages")).toBeVisible();
    fireEvent.keyDown(input, { key: "Escape" });

    const implementation = invokeMock.getMockImplementation()!;
    invokeMock.mockImplementation((command, args) =>
      command === "search_pages"
        ? Promise.reject(new Error("search unavailable"))
        : implementation(command, args),
    );
    fireEvent.keyDown(window, { key: "p", ctrlKey: true });
    const retryInput = screen.getByRole("searchbox", { name: "Search pages and notes" });
    fireEvent.change(retryInput, { target: { value: "alpha" } });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Search could not be completed.",
    );
  });

  it("prevents an older search response from replacing newer results", async () => {
    mockPageCommands([page("alpha", "Alpha"), page("beta", "Beta", null, 1)]);
    const implementation = invokeMock.getMockImplementation()!;
    let resolveAlpha!: (value: unknown) => void;
    let resolveBeta!: (value: unknown) => void;
    invokeMock.mockImplementation((command, args) => {
      if (command !== "search_pages") return implementation(command, args);
      return new Promise((resolve) => {
        if (args.query === "alpha") resolveAlpha = resolve;
        else resolveBeta = resolve;
      });
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });
    fireEvent.keyDown(window, { key: "p", ctrlKey: true });
    const input = screen.getByRole("searchbox", { name: "Search pages and notes" });
    fireEvent.change(input, { target: { value: "alpha" } });
    fireEvent.change(input, { target: { value: "beta" } });

    await act(async () => {
      resolveBeta([{ pageId: "beta", title: "Beta", snippet: "newer" }]);
    });
    expect(await screen.findByRole("button", { name: "Beta newer" })).toBeVisible();
    await act(async () => {
      resolveAlpha([{ pageId: "alpha", title: "Alpha", snippet: "older" }]);
    });
    expect(screen.getByRole("button", { name: "Beta newer" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Alpha older" })).not.toBeInTheDocument();
  });

  it("reflects rename, autosave, and delete changes at the mocked search boundary", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });
    fireEvent.click(within(openPageActions("Alpha")).getByRole("menuitem", { name: "Rename" }));
    const renameInput = screen.getByRole("textbox", { name: "Rename Alpha" });
    fireEvent.change(renameInput, { target: { value: "Renamed" } });
    fireEvent.keyDown(renameInput, { key: "Enter" });
    await screen.findByRole("heading", { name: "Renamed" });

    fireEvent.click(screen.getByRole("button", { name: "Simulate editor change" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"), {
      timeout: 1500,
    });
    fireEvent.keyDown(window, { key: "p", ctrlKey: true });
    const searchInput = screen.getByRole("searchbox", { name: "Search pages and notes" });
    fireEvent.change(searchInput, { target: { value: "Edited content" } });
    expect(await screen.findByRole("button", { name: "Renamed Matching note text" })).toBeVisible();
    fireEvent.keyDown(searchInput, { key: "Escape" });

    fireEvent.click(within(openPageActions("Renamed")).getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Move to Trash" }),
    );
    await screen.findByRole("heading", { name: "No pages yet" });
    fireEvent.keyDown(window, { key: "p", ctrlKey: true });
    const deletedSearchInput = screen.getByRole("searchbox", { name: "Search pages and notes" });
    fireEvent.change(deletedSearchInput, { target: { value: "Renamed" } });
    expect(await screen.findByText("No matching pages")).toBeVisible();
  });

  it("shows the Markdown export action only for an active page", async () => {
    mockPageCommands([]);
    const view = render(<App />);
    await screen.findByRole("heading", { name: "No pages yet" });
    expect(screen.queryByRole("button", { name: "Page actions" }))
      .not.toBeInTheDocument();

    view.unmount();
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });
    fireEvent.click(screen.getByRole("button", { name: "Page actions" }));
    expect(screen.getByRole("menuitem", { name: "Export Markdown" })).toBeVisible();
  });

  it("flushes pending edits, reloads SQLite content, then exports it", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });

    fireEvent.click(screen.getByRole("button", { name: "Simulate editor change" }));
    fireEvent.click(screen.getByRole("button", { name: "Page actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Export Markdown" }));

    expect(await screen.findByText("Markdown exported.")).toBeVisible();
    const calls = invokeMock.mock.calls.map(([command, args], index) => ({
      command,
      args,
      index,
    }));
    const save = calls.find(
      ({ command, args }) => command === "save_document" && args.pageId === "alpha",
    )!;
    const persistedLoad = calls.find(
      ({ command, args, index }) =>
        command === "load_document" && args.pageId === "alpha" && index > save.index,
    )!;
    const exportCall = calls.find(({ command }) => command === "export_markdown")!;

    expect(save.index).toBeLessThan(persistedLoad.index);
    expect(persistedLoad.index).toBeLessThan(exportCall.index);
    expect(exportCall.args).toEqual({
      pageId: "alpha",
      contentJson: JSON.stringify([{ type: "paragraph", content: "Edited content" }]),
      markdown: expect.stringContaining("Edited content"),
    });
  });

  it("handles Save As cancellation silently", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    const implementation = invokeMock.getMockImplementation()!;
    invokeMock.mockImplementation((command, args) =>
      command === "export_markdown"
        ? Promise.resolve({ exported: false })
        : implementation(command, args),
    );
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });

    fireEvent.click(screen.getByRole("button", { name: "Page actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Export Markdown" }));

    await waitFor(() =>
      expect(screen.queryByText("Markdown exported.")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/Could not export this page/)).not.toBeInTheDocument();
  });

  it("does not open export when flushing pending content fails", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    const implementation = invokeMock.getMockImplementation()!;
    invokeMock.mockImplementation((command, args) =>
      command === "save_document"
        ? Promise.reject(new Error("disk full"))
        : implementation(command, args),
    );
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });
    fireEvent.click(screen.getByRole("button", { name: "Simulate editor change" }));

    fireEvent.click(screen.getByRole("button", { name: "Page actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Export Markdown" }));

    expect(await screen.findByText(/Export stopped because/)).toBeVisible();
    expect(invokeMock.mock.calls.some(([command]) => command === "export_markdown"))
      .toBe(false);
    expect(screen.getByRole("textbox", { name: "BlockNote editing surface" }))
      .toHaveAttribute("data-document", expect.stringContaining("Edited content"));
  });

  it("reports conversion failures without changing the source note", async () => {
    mockPageCommands(
      [page("alpha", "Alpha")],
      { alpha: JSON.stringify([{ type: "paragraph", content: "Original" }]) },
    );
    markdownSerializerMock.mockImplementation(() => {
      throw new Error("conversion failed");
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });

    fireEvent.click(screen.getByRole("button", { name: "Page actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Export Markdown" }));

    expect(await screen.findByText(/conversion failed/)).toBeVisible();
    expect(invokeMock.mock.calls.some(([command]) => command === "export_markdown"))
      .toBe(false);
    expect(screen.getByRole("textbox", { name: "BlockNote editing surface" }))
      .toHaveAttribute("data-document", expect.stringContaining("Original"));
  });

  it("collapses and expands the sidebar via toggle button and Ctrl+\\ shortcut", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });

    // Initial state: expanded sidebar
    const collapseButton = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(collapseButton).toBeInTheDocument();

    // Click collapse
    fireEvent.click(collapseButton);

    // Sidebar is now collapsed
    const expandButton = await screen.findByRole("button", { name: "Expand sidebar" });
    expect(expandButton).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Workspace navigation" })).toHaveClass(
      "sidebar--collapsed",
    );

    // Click expand
    fireEvent.click(expandButton);
    expect(await screen.findByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Workspace navigation" })).not.toHaveClass(
      "sidebar--collapsed",
    );

    // Toggle collapse via Ctrl+\ shortcut
    fireEvent.keyDown(window, { key: "\\", ctrlKey: true });
    expect(await screen.findByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();

    // Toggle expand via Ctrl+\ shortcut
    fireEvent.keyDown(window, { key: "\\", ctrlKey: true });
    expect(await screen.findByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  it("moves note to trash, and allows restoring or permanently deleting from trash dialog", async () => {
    mockPageCommands([page("alpha", "Alpha")]);
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });

    // Delete note via confirmation pop-up
    fireEvent.click(within(openPageActions("Alpha")).getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Move to Trash" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "No pages yet" })).toBeVisible(),
    );

    // Open Trash dialog from sidebar footer
    const trashButton = screen.getByRole("button", { name: "Open trash" });
    expect(trashButton).toBeVisible();
    fireEvent.click(trashButton);

    // Verify Trash dialog is open and displays the trashed note
    const trashDialog = await screen.findByRole("dialog", { name: "Trash" });
    expect(trashDialog).toBeVisible();
    expect(within(trashDialog).getByText("Alpha")).toBeVisible();

    // Click Restore button
    const restoreButton = within(trashDialog).getByRole("button", { name: "Restore Alpha" });
    fireEvent.click(restoreButton);

    // Verify the restored note reappears in active pages and editor
    await waitFor(() =>
      expect(within(screen.getByRole("region", { name: "Pages" })).getByRole("button", { name: "Alpha" })).toBeVisible(),
    );
    expect(within(trashDialog).getByText("Trash is empty")).toBeVisible();

    // Close Trash dialog
    fireEvent.click(within(trashDialog).getByRole("button", { name: "Close trash dialog" }));
    expect(screen.queryByRole("dialog", { name: "Trash" })).not.toBeInTheDocument();

    // Delete it again
    fireEvent.click(within(openPageActions("Alpha")).getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Move to Trash" }),
    );

    // Open Trash again
    fireEvent.click(screen.getByRole("button", { name: "Open trash" }));
    const trashDialog2 = await screen.findByRole("dialog", { name: "Trash" });

    // Click Delete permanently
    fireEvent.click(within(trashDialog2).getByRole("button", { name: "Permanently delete Alpha" }));

    // Confirm permanent deletion in the confirmation alertdialog
    const confirmDialog = await screen.findByRole("alertdialog", { name: "Permanently Delete Note" });
    expect(confirmDialog).toBeVisible();
    fireEvent.click(within(confirmDialog).getByRole("button", { name: "Delete Permanently" }));

    // Verify trash is empty
    await waitFor(() =>
      expect(within(trashDialog2).getByText("Trash is empty")).toBeVisible(),
    );
  });

  it("toggles focus mode via Ctrl+Shift+F shortcut and header button, preserving editor content", async () => {
    mockPageCommands([page("alpha", "Alpha")], {
      alpha: JSON.stringify([{ type: "paragraph", content: "Focus mode note" }]),
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Alpha" });
    const editor = await screen.findByRole("textbox", { name: "BlockNote editing surface" });
    expect(editor).toBeVisible();

    // Verify initial state has sidebar visible
    expect(screen.getByRole("complementary", { name: "Workspace navigation" })).toBeVisible();
    const focusButton = screen.getByRole("button", { name: "Focus mode" });
    expect(focusButton).toBeVisible();

    // Activate focus mode via Ctrl+Shift+F
    fireEvent.keyDown(window, { key: "f", ctrlKey: true, shiftKey: true });

    // Sidebar should be hidden, but editor, title and content remain visible
    expect(screen.queryByRole("complementary", { name: "Workspace navigation" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alpha" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "BlockNote editing surface" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Exit focus mode" })).toBeVisible();

    // Deactivate focus mode via header button
    fireEvent.click(screen.getByRole("button", { name: "Exit focus mode" }));

    // Sidebar should be restored
    expect(await screen.findByRole("complementary", { name: "Workspace navigation" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Focus mode" })).toBeVisible();
  });
});

