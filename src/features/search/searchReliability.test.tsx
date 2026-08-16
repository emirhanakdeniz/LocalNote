import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuickSearch } from "./QuickSearch";
import { searchApi } from "./api";
import type { SearchResult } from "./api";

describe("QuickSearch Reliability & Race-Condition Suite", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("handles out-of-order search responses by only rendering the latest query revision", async () => {
    let slowResolve!: (val: SearchResult[]) => void;
    const slowPromise = new Promise<SearchResult[]>((res) => {
      slowResolve = res;
    });

    vi.spyOn(searchApi, "search").mockImplementation(async (query) => {
      if (query === "slow") {
        return slowPromise;
      }
      return [
        {
          pageId: "page-fast",
          title: "Fast Query Result",
          snippet: "Matching fast text",
        },
      ];
    });

    const onSelect = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    render(<QuickSearch open={true} onClose={onClose} onSelect={onSelect} />);

    const input = screen.getByRole("searchbox", { name: /search pages and notes/i });

    // User types "slow"
    act(() => {
      fireEvent.change(input, { target: { value: "slow" } });
    });

    // User quickly changes mind and types "fast"
    act(() => {
      fireEvent.change(input, { target: { value: "fast" } });
    });

    await waitFor(() => {
      expect(screen.getByText("Fast Query Result")).toBeInTheDocument();
    });

    // Now the slow response finally arrives late
    await act(async () => {
      slowResolve([
        {
          pageId: "page-slow",
          title: "Stale Slow Result",
          snippet: "This should be discarded",
        },
      ]);
    });

    // Stale slow result must NOT overwrite the current fast result
    expect(screen.queryByText("Stale Slow Result")).not.toBeInTheDocument();
    expect(screen.getByText("Fast Query Result")).toBeInTheDocument();
  });

  it("safely queries with special punctuation and operators without crashing", async () => {
    const searchSpy = vi.spyOn(searchApi, "search").mockResolvedValue([]);
    const onSelect = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    render(<QuickSearch open={true} onClose={onClose} onSelect={onSelect} />);

    const input = screen.getByRole("searchbox", { name: /search pages and notes/i });

    // FTS5 special character edge cases
    const specialQueries = [
      `"unclosed quote`,
      `AND OR NOT NEAR`,
      `* wildcard : colons (parentheses)`,
      `🔥 emoji & symbols % ^ ~`,
    ];

    for (const specialQuery of specialQueries) {
      act(() => {
        fireEvent.change(input, { target: { value: specialQuery } });
      });

      await waitFor(() => {
        expect(searchSpy).toHaveBeenCalledWith(specialQuery);
      });
    }

    // Displays calm empty state when no matches found
    await waitFor(() => {
      expect(screen.getByText("No matching pages")).toBeInTheDocument();
    });
  });

  it("supports cyclic keyboard navigation with arrow keys and wrap-around", async () => {
    vi.spyOn(searchApi, "search").mockResolvedValue([
      { pageId: "p1", title: "Note 1", snippet: "..." },
      { pageId: "p2", title: "Note 2", snippet: "..." },
      { pageId: "p3", title: "Note 3", snippet: "..." },
    ]);

    const onSelect = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    const { container } = render(<QuickSearch open={true} onClose={onClose} onSelect={onSelect} />);

    const input = screen.getByRole("searchbox", { name: /search pages and notes/i });

    act(() => {
      fireEvent.change(input, { target: { value: "Note" } });
    });

    await waitFor(() => {
      expect(screen.getByText("Note 1")).toBeInTheDocument();
    });

    const getItems = () => container.querySelectorAll<HTMLButtonElement>(".quick-search__result");
    expect(getItems()[0]).toHaveAttribute("aria-selected", "true");

    // Arrow down -> selects Note 2
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(getItems()[1]).toHaveAttribute("aria-selected", "true");

    // Arrow down -> selects Note 3
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(getItems()[2]).toHaveAttribute("aria-selected", "true");

    // Arrow down -> wraps to Note 1
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(getItems()[0]).toHaveAttribute("aria-selected", "true");

    // Arrow up -> wraps to Note 3
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(getItems()[2]).toHaveAttribute("aria-selected", "true");

    // Press Enter -> selects Note 3
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith("p3");
      expect(onClose).toHaveBeenCalled();
    });
  });
});
