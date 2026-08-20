import { useState, useRef, useEffect, useId, cloneElement, isValidElement, type ReactNode } from "react";

type TooltipPosition = "top" | "bottom" | "left" | "right";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  position?: TooltipPosition;
  delayMs?: number;
  className?: string;
  disabled?: boolean;
};

export function Tooltip({
  content,
  children,
  position = "top",
  delayMs = 250,
  className = "",
  disabled = false,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (disabled || !content) return;
    timeoutRef.current = setTimeout(() => {
      setVisible(true);
    }, delayMs);
  };

  const hide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      className={`tooltip-wrapper ${className}`.trim()}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {isValidElement<{ "aria-describedby"?: string }>(children)
        ? cloneElement(children, {
            "aria-describedby": visible ? tooltipId : children.props["aria-describedby"],
          })
        : children}
      {visible && (
        <div
          role="tooltip"
          id={tooltipId}
          className={`tooltip tooltip--${position}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
