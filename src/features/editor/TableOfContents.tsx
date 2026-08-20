import { useEffect, useState, useMemo } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { PartialBlock } from "@blocknote/core";
import { Icon } from "../../components/Icon";

export type HeadingItem = {
  id: string;
  level: number;
  text: string;
};

type TableOfContentsProps = {
  blocks: PartialBlock[];
  editorRoot: HTMLElement | null;
  isVisible: boolean;
  onToggleVisible?: () => void;
  width?: number;
  onResizerPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizerDoubleClick?: () => void;
  className?: string;
};

function extractHeadings(blocks: PartialBlock[]): HeadingItem[] {
  const headings: HeadingItem[] = [];

  for (const block of blocks) {
    if (block.type === "heading" && block.props && "level" in block.props) {
      const level = Number(block.props.level) || 1;
      let text = "";
      if (typeof block.content === "string") {
        text = block.content;
      } else if (Array.isArray(block.content)) {
        text = block.content
          .map((item) => {
            if (typeof item === "string") return item;
            if (typeof item === "object" && item !== null && "text" in item) {
              return (item as { text?: string }).text ?? "";
            }
            return "";
          })
          .join("");
      }
      if (block.id) {
        headings.push({
          id: String(block.id),
          level,
          text: text.trim() || `Heading ${level}`,
        });
      }
    }
  }

  return headings;
}

export function TableOfContents({
  blocks,
  editorRoot,
  isVisible,
  onToggleVisible,
  width,
  onResizerPointerDown,
  onResizerDoubleClick,
  className = "",
}: TableOfContentsProps) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

  const headings = useMemo(() => extractHeadings(blocks), [blocks]);

  useEffect(() => {
    if (!editorRoot || headings.length === 0) {
      setActiveHeadingId(null);
      return;
    }

    const scrollContainer = editorRoot.closest(".content-area") || window;

    const handleScroll = () => {
      const headingElements = headings
        .map((h) => ({
          id: h.id,
          element: editorRoot.querySelector(`[data-id="${h.id}"]`),
        }))
        .filter((h): h is { id: string; element: Element } => h.element !== null);

      if (!headingElements.length) return;

      const viewportTop = 160;
      let currentActive = headingElements[0].id;

      for (const item of headingElements) {
        const rect = item.element.getBoundingClientRect();
        if (rect.top <= viewportTop) {
          currentActive = item.id;
        } else {
          break;
        }
      }

      setActiveHeadingId(currentActive);
    };

    handleScroll();
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [editorRoot, headings]);

  if (!isVisible) return null;

  const scrollToHeading = (id: string) => {
    if (!editorRoot) return;
    const element = editorRoot.querySelector(`[data-id="${id}"]`);
    if (element) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      setActiveHeadingId(id);
    }
  };

  const style = width ? ({ "--toc-width": `${width}px` } as React.CSSProperties) : undefined;

  return (
    <aside
      className={`table-of-contents ${className}`.trim()}
      style={style}
      aria-label="Table of contents"
    >
      <div
        className="table-of-contents__resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Table of contents resize handle"
        title="Double click to reset or drag to resize"
        onPointerDown={onResizerPointerDown}
        onDoubleClick={onResizerDoubleClick}
      />

      <div className="table-of-contents__header">
        <div className="table-of-contents__title-row">
          <Icon name="list" className="table-of-contents__icon" />
          <span className="table-of-contents__heading">Contents</span>
        </div>
        {onToggleVisible && (
          <button
            type="button"
            className="table-of-contents__close-btn"
            aria-label="Hide table of contents"
            title="Hide table of contents"
            onClick={onToggleVisible}
          >
            <Icon name="x" />
          </button>
        )}
      </div>

      <div className="table-of-contents__body">
        {headings.length === 0 ? (
          <p className="table-of-contents__empty">
            No headings in this note yet. Use # or slash command to add headings.
          </p>
        ) : (
          <nav className="table-of-contents__nav">
            <ul className="table-of-contents__list">
              {headings.map((heading) => {
                const isActive = activeHeadingId === heading.id;
                return (
                  <li
                    key={heading.id}
                    className={`table-of-contents__item table-of-contents__item--level-${heading.level}${isActive ? " table-of-contents__item--active" : ""}`}
                  >
                    <button
                      type="button"
                      className="table-of-contents__link"
                      aria-current={isActive ? "location" : undefined}
                      onClick={() => scrollToHeading(heading.id)}
                    >
                      <span className="table-of-contents__label">{heading.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>
    </aside>
  );
}
