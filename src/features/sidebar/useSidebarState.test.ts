import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  useSidebarState,
} from "./useSidebarState";

describe("useSidebarState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initializes with default values when localStorage is empty", () => {
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.width).toBe(DEFAULT_SIDEBAR_WIDTH);
    expect(result.current.isCollapsed).toBe(false);
    expect(result.current.isResizing).toBe(false);
  });

  it("toggles collapsed state and updates localStorage", () => {
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      result.current.toggleCollapse();
    });
    expect(result.current.isCollapsed).toBe(true);
    expect(localStorage.getItem("localnote:sidebar-collapsed")).toBe("true");

    act(() => {
      result.current.toggleCollapse();
    });
    expect(result.current.isCollapsed).toBe(false);
    expect(localStorage.getItem("localnote:sidebar-collapsed")).toBe("false");
  });

  it("clamps width between MIN and MAX limits", () => {
    const { result } = renderHook(() => useSidebarState());

    act(() => {
      result.current.updateWidth(100); // Below MIN
    });
    expect(result.current.width).toBe(MIN_SIDEBAR_WIDTH);
    expect(localStorage.getItem("localnote:sidebar-width")).toBe(String(MIN_SIDEBAR_WIDTH));

    act(() => {
      result.current.updateWidth(600); // Above MAX
    });
    expect(result.current.width).toBe(MAX_SIDEBAR_WIDTH);
    expect(localStorage.getItem("localnote:sidebar-width")).toBe(String(MAX_SIDEBAR_WIDTH));

    act(() => {
      result.current.updateWidth(300); // In range
    });
    expect(result.current.width).toBe(300);
  });

  it("resets to default width or toggles collapse on double click", () => {
    const { result } = renderHook(() => useSidebarState());

    // Modify width
    act(() => {
      result.current.updateWidth(350);
    });
    expect(result.current.width).toBe(350);

    // Double click resets to default
    act(() => {
      result.current.handleResizerDoubleClick();
    });
    expect(result.current.width).toBe(DEFAULT_SIDEBAR_WIDTH);

    // Double click when at default width collapses
    act(() => {
      result.current.handleResizerDoubleClick();
    });
    expect(result.current.isCollapsed).toBe(true);

    // Double click when collapsed uncollapses and resets to default
    act(() => {
      result.current.handleResizerDoubleClick();
    });
    expect(result.current.isCollapsed).toBe(false);
    expect(result.current.width).toBe(DEFAULT_SIDEBAR_WIDTH);
  });
});
