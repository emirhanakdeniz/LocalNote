import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export const DEFAULT_TOC_WIDTH = 230;
export const MIN_TOC_WIDTH = 180;
export const MAX_TOC_WIDTH = 420;

const TOC_WIDTH_STORAGE_KEY = "localnote:toc-width";
const TOC_VISIBLE_STORAGE_KEY = "localnote:toc-visible";

function getInitialWidth(): number {
  try {
    const saved = localStorage.getItem(TOC_WIDTH_STORAGE_KEY);
    if (saved) {
      const parsed = Number.parseInt(saved, 10);
      if (!Number.isNaN(parsed)) {
        return Math.min(MAX_TOC_WIDTH, Math.max(MIN_TOC_WIDTH, parsed));
      }
    }
  } catch {
    // Ignore storage errors in restricted environments
  }
  return DEFAULT_TOC_WIDTH;
}

function getInitialVisible(): boolean {
  try {
    const saved = localStorage.getItem(TOC_VISIBLE_STORAGE_KEY);
    if (saved !== null) {
      return saved === "true";
    }
  } catch {
    // Ignore storage errors
  }
  return true;
}

export function useTocState() {
  const [width, setWidth] = useState<number>(getInitialWidth);
  const [isVisible, setIsVisible] = useState<boolean>(getInitialVisible);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  const widthRef = useRef(width);
  widthRef.current = width;

  const isVisibleRef = useRef(isVisible);
  isVisibleRef.current = isVisible;

  const setVisible = useCallback((visible: boolean) => {
    setIsVisible(visible);
    try {
      localStorage.setItem(TOC_VISIBLE_STORAGE_KEY, String(visible));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleVisible = useCallback(() => {
    setVisible(!isVisibleRef.current);
  }, [setVisible]);

  const updateWidth = useCallback((newWidth: number) => {
    const clamped = Math.min(MAX_TOC_WIDTH, Math.max(MIN_TOC_WIDTH, newWidth));
    setWidth(clamped);
    try {
      localStorage.setItem(TOC_WIDTH_STORAGE_KEY, String(clamped));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleResizerPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsResizing(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      // TOC is on the right side of the window, so dragging left increases width:
      const calculatedWidth = window.innerWidth - moveEvent.clientX;
      if (calculatedWidth < MIN_TOC_WIDTH - 40) {
        if (isVisibleRef.current) {
          setVisible(false);
        }
      } else {
        if (!isVisibleRef.current) {
          setVisible(true);
        }
        updateWidth(calculatedWidth);
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
  }, [setVisible, updateWidth]);

  const handleResizerDoubleClick = useCallback(() => {
    if (!isVisibleRef.current) {
      setVisible(true);
      updateWidth(DEFAULT_TOC_WIDTH);
    } else if (widthRef.current !== DEFAULT_TOC_WIDTH) {
      updateWidth(DEFAULT_TOC_WIDTH);
    } else {
      setVisible(false);
    }
  }, [setVisible, updateWidth]);

  return {
    width,
    isVisible,
    isResizing,
    setVisible,
    toggleVisible,
    updateWidth,
    handleResizerPointerDown,
    handleResizerDoubleClick,
  };
}
