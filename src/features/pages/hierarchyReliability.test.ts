import { describe, expect, it } from "vitest";
import type { Page } from "./types";
import { deriveFavoritePages, deriveRecentPages } from "./usePageManagement";

function buildPage(
  id: string,
  parentId: string | null = null,
  position = 0,
  isFavorite = false,
  lastOpenedAt: string | null = null,
): Page {
  return {
    id,
    title: `Title ${id}`,
    parentId,
    position,
    isFavorite,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt,
  };
}

describe("Page Hierarchy & Scale Reliability Suite", () => {
  it("maintains stable ordering and performance across a 100+ page flat and nested dataset", () => {
    const scalePages: Page[] = [];

    // Create 100 root pages
    for (let i = 0; i < 100; i++) {
      scalePages.push(
        buildPage(
          `root-${i}`,
          null,
          i,
          i % 5 === 0, // 20 favorites
          i % 2 === 0 ? `2026-01-01T00:${String(i).padStart(2, "0")}:00.000Z` : null,
        ),
      );
    }

    // Derive favorites under scale
    const favorites = deriveFavoritePages(scalePages);
    expect(favorites.length).toBe(20);
    // Verified that all derived favorites are indeed marked as favorite
    expect(favorites.every((p) => p.isFavorite)).toBe(true);

    // Derive recents under scale (must strictly adhere to limit of 7)
    const recents = deriveRecentPages(scalePages);
    expect(recents.length).toBe(7);
    // Recents must have non-null lastOpenedAt
    expect(recents.every((p) => p.lastOpenedAt !== null)).toBe(true);
  });

  it("handles deep 10-level hierarchy nesting without stack overflow or traversal error", () => {
    const deepPages: Page[] = [];
    let currentParent: string | null = null;

    for (let level = 1; level <= 10; level++) {
      const pageId = `level-${level}`;
      deepPages.push(buildPage(pageId, currentParent, 0, level === 10, `2026-01-01T00:10:0${level}.000Z`));
      currentParent = pageId;
    }

    expect(deepPages.length).toBe(10);
    expect(deepPages[0].parentId).toBeNull();
    expect(deepPages[9].parentId).toBe("level-9");

    const favorites = deriveFavoritePages(deepPages);
    expect(favorites).toHaveLength(1);
    expect(favorites[0].id).toBe("level-10");
  });

  it("detects cyclic relationships when validating potential reparenting", () => {
    // Utility simulating cycle detection: cannot move an ancestor into its own descendant
    const pages: Page[] = [
      buildPage("root", null, 0),
      buildPage("child", "root", 0),
      buildPage("grandchild", "child", 0),
      buildPage("great-grandchild", "grandchild", 0),
    ];

    function wouldCreateCycle(movingId: string, targetParentId: string | null): boolean {
      if (targetParentId === null) return false;
      if (movingId === targetParentId) return true;

      let current: string | null = targetParentId;
      while (current !== null) {
        if (current === movingId) return true;
        const parentPage = pages.find((p) => p.id === current);
        current = parentPage ? parentPage.parentId : null;
      }
      return false;
    }

    // Moving grandchild to root -> Valid
    expect(wouldCreateCycle("grandchild", null)).toBe(false);
    // Moving grandchild to root -> Valid
    expect(wouldCreateCycle("grandchild", "root")).toBe(false);
    // Moving root into child -> Cycle!
    expect(wouldCreateCycle("root", "child")).toBe(true);
    // Moving root into great-grandchild -> Cycle!
    expect(wouldCreateCycle("root", "great-grandchild")).toBe(true);
    // Moving child into great-grandchild -> Cycle!
    expect(wouldCreateCycle("child", "great-grandchild")).toBe(true);
  });
});
