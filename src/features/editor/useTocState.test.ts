import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TOC_WIDTH,
  MAX_TOC_WIDTH,
  MIN_TOC_WIDTH,
  useTocState,
} from "./useTocState";

describe("useTocState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initializes with default width and visible state", () => {
    const { result } = renderHook(() => useTocState());
    expect(result.current.width).toBe(DEFAULT_TOC_WIDTH);
    expect(result.current.isVisible).toBe(true);
    expect(result.current.isResizing).toBe(false);
  });

  it("updates width within minimum and maximum bounds and persists to localStorage", () => {
    const { result } = renderHook(() => useTocState());

    act(() => {
      result.current.updateWidth(300);
    });
    expect(result.current.width).toBe(300);
    expect(localStorage.getItem("localnote:toc-width")).toBe("300");

    // Clamps below minimum
    act(() => {
      result.current.updateWidth(100);
    });
    expect(result.current.width).toBe(MIN_TOC_WIDTH);

    // Clamps above maximum
    act(() => {
      result.current.updateWidth(600);
    });
    expect(result.current.width).toBe(MAX_TOC_WIDTH);
  });

  it("toggles visibility and stores preference", () => {
    const { result } = renderHook(() => useTocState());

    act(() => {
      result.current.toggleVisible();
    });
    expect(result.current.isVisible).toBe(false);
    expect(localStorage.getItem("localnote:toc-visible")).toBe("false");

    act(() => {
      result.current.toggleVisible();
    });
    expect(result.current.isVisible).toBe(true);
    expect(localStorage.getItem("localnote:toc-visible")).toBe("true");
  });

  it("resets to default width on double click", () => {
    const { result } = renderHook(() => useTocState());

    act(() => {
      result.current.updateWidth(350);
    });
    expect(result.current.width).toBe(350);

    act(() => {
      result.current.handleResizerDoubleClick();
    });
    expect(result.current.width).toBe(DEFAULT_TOC_WIDTH);
  });
});
