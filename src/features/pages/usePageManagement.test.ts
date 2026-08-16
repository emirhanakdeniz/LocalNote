import { describe, expect, it } from "vitest";
import type { Page } from "./types";
import {
  deriveFavoritePages,
  deriveRecentPages,
  RECENT_PAGE_LIMIT,
} from "./usePageManagement";

function page(
  id: string,
  lastOpenedAt: string | null,
  isFavorite = false,
): Page {
  return {
    id,
    title: id,
    parentId: null,
    position: 0,
    isFavorite,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt,
  };
}

describe("page sidebar derivation", () => {
  it("orders favorites by recent activity with tree order as a stable fallback", () => {
    const pages = [
      page("first", null, true),
      page("second", "2026-01-01T00:02:00.000Z", true),
      page("third", "2026-01-01T00:02:00.000Z", true),
      page("not-favorite", "2026-01-01T00:03:00.000Z"),
    ];

    expect(deriveFavoritePages(pages).map(({ id }) => id)).toEqual([
      "second",
      "third",
      "first",
    ]);
  });

  it("excludes unopened pages and limits deterministic recent ordering", () => {
    const pages = [page("unopened", null)];
    for (let index = 0; index < RECENT_PAGE_LIMIT + 2; index += 1) {
      pages.push(page(`opened-${index}`, `2026-01-01T00:00:${String(index).padStart(2, "0")}.000Z`));
    }

    expect(deriveRecentPages(pages).map(({ id }) => id)).toEqual(
      Array.from(
        { length: RECENT_PAGE_LIMIT },
        (_, offset) => `opened-${RECENT_PAGE_LIMIT + 1 - offset}`,
      ),
    );
  });
});
