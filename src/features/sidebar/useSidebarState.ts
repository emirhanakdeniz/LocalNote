import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export const DEFAULT_SIDEBAR_WIDTH = 240;
export const MIN_SIDEBAR_WIDTH = 180;
export const MAX_SIDEBAR_WIDTH = 480;
export const COLLAPSED_SIDEBAR_WIDTH = 48;

const WIDTH_STORAGE_KEY = "localnote:sidebar-width";
const COLLAPSED_STORAGE_KEY = "localnote:sidebar-collapsed";

function getInitialWidth(): number {
  try {
    const saved = localStorage.getItem(WIDTH_STORAGE_KEY);
    if (saved) {
      const parsed = Number.parseInt(saved, 10);
      if (!Number.isNaN(parsed)) {
        return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, parsed));
      }
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return DEFAULT_SIDEBAR_WIDTH;
}

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function useSidebarState() {
  const [width, setWidth] = useState<number>(getInitialWidth);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(getInitialCollapsed);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  const widthRef = useRef(width);
  widthRef.current = width;

  const isCollapsedRef = useRef(isCollapsed);
  isCollapsedRef.current = isCollapsed;

  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed(!isCollapsedRef.current);
  }, [setCollapsed]);

  const updateWidth = useCallback((newWidth: number) => {
    const clamped = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, newWidth));
    setWidth(clamped);
    try {
      localStorage.setItem(WIDTH_STORAGE_KEY, String(clamped));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleResizerPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsResizing(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const clientX = moveEvent.clientX;
      if (clientX < MIN_SIDEBAR_WIDTH - 40) {
        if (!isCollapsedRef.current) {
          setCollapsed(true);
        }
      } else {
        if (isCollapsedRef.current) {
          setCollapsed(false);
        }
        updateWidth(clientX);
      }
    };

    const onPointerUp = () => {
      setIsResizing(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }, [setCollapsed, updateWidth]);

  const handleResizerDoubleClick = useCallback(() => {
    if (isCollapsedRef.current) {
      setCollapsed(false);
      updateWidth(DEFAULT_SIDEBAR_WIDTH);
    } else if (widthRef.current !== DEFAULT_SIDEBAR_WIDTH) {
      updateWidth(DEFAULT_SIDEBAR_WIDTH);
    } else {
      setCollapsed(true);
    }
  }, [setCollapsed, updateWidth]);

  return {
    width,
    isCollapsed,
    isResizing,
    setCollapsed,
    toggleCollapse,
    updateWidth,
    handleResizerPointerDown,
    handleResizerDoubleClick,
  };
}
