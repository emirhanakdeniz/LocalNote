export type IconName =
  | "chevron"
  | "clock"
  | "document"
  | "download"
  | "ellipsis"
  | "folder-plus"
  | "moon"
  | "move"
  | "pencil"
  | "plus"
  | "search"
  | "settings"
  | "sidebar"
  | "info"
  | "copy"
  | "check"
  | "spark"
  | "star"
  | "sun"
  | "trash"
  | "arrow-up"
  | "arrow-down"
  | "list"
  | "focus"
  | "tag"
  | "rotate-ccw"
  | "alert-triangle"
  | "x";

type IconProps = {
  name: IconName;
  className?: string;
};

export function Icon({ name, className = "" }: IconProps) {
  const classes = `icon ${className}`.trim();

  return (
    <svg
      aria-hidden="true"
      className={classes}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "search" && (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </>
      )}
      {name === "settings" && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12.2 3h-.4a1.8 1.8 0 0 0-1.8 1.8v.3a1.8 1.8 0 0 1-.9 1.55l-.35.2a1.8 1.8 0 0 1-1.8 0l-.25-.14a1.8 1.8 0 0 0-2.46.66l-.2.35a1.8 1.8 0 0 0 .66 2.46l.25.14a1.8 1.8 0 0 1 .9 1.56v.4a1.8 1.8 0 0 1-.9 1.56l-.25.14a1.8 1.8 0 0 0-.66 2.46l.2.35a1.8 1.8 0 0 0 2.46.66l.25-.14a1.8 1.8 0 0 1 1.8 0l.35.2a1.8 1.8 0 0 1 .9 1.55v.3a1.8 1.8 0 0 0 1.8 1.8h.4a1.8 1.8 0 0 0 1.8-1.8v-.3a1.8 1.8 0 0 1 .9-1.55l.35-.2a1.8 1.8 0 0 1 1.8 0l.25.14a1.8 1.8 0 0 0 2.46-.66l.2-.35a1.8 1.8 0 0 0-.66-2.46l-.25-.14a1.8 1.8 0 0 1-.9-1.56v-.4a1.8 1.8 0 0 1 .9-1.56l.25-.14a1.8 1.8 0 0 0 .66-2.46l-.2-.35a1.8 1.8 0 0 0-2.46-.66l-.25.14a1.8 1.8 0 0 1-1.8 0l-.35-.2a1.8 1.8 0 0 1-.9-1.55v-.3A1.8 1.8 0 0 0 12.2 3Z" />
        </>
      )}
      {name === "sidebar" && (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16" />
        </>
      )}
      {name === "info" && (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 10.5v5M12 7.5h.01" />
        </>
      )}
      {name === "download" && (
        <>
          <path d="M12 3v11" />
          <path d="m8 10 4 4 4-4M5 19h14" />
        </>
      )}
      {name === "copy" && (
        <>
          <rect x="8" y="8" width="11" height="11" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </>
      )}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "star" && (
        <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
      )}
      {name === "clock" && (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5l3 2" />
        </>
      )}
      {name === "document" && (
        <>
          <path d="M6.5 3.5h7l4 4v13h-11z" />
          <path d="M13.5 3.5v4h4" />
        </>
      )}
      {name === "plus" && <path d="M12 5v14M5 12h14" />}
      {name === "ellipsis" && (
        <>
          <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
        </>
      )}
      {name === "pencil" && (
        <>
          <path d="m4 20 4.2-1 10.5-10.5a2.1 2.1 0 0 0-3-3L5.2 16z" />
          <path d="m14.5 6.7 3 3" />
        </>
      )}
      {name === "folder-plus" && (
        <>
          <path d="M3.5 7.5h6l2-2h9v14h-17z" />
          <path d="M12 10v6M9 13h6" />
        </>
      )}
      {name === "move" && (
        <>
          <path d="M12 3v18M3 12h18" />
          <path d="m8.5 6.5 3.5-3.5 3.5 3.5M8.5 17.5 12 21l3.5-3.5M6.5 8.5 3 12l3.5 3.5M17.5 8.5 21 12l-3.5 3.5" />
        </>
      )}
      {name === "arrow-up" && <path d="m6 14 6-6 6 6" />}
      {name === "arrow-down" && <path d="m6 10 6 6 6-6" />}
      {name === "trash" && (
        <>
          <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" />
          <path d="M10 11v5M14 11v5" />
        </>
      )}
      {name === "sun" && (
        <>
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </>
      )}
      {name === "moon" && <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2z" />}
      {name === "chevron" && <path d="m7 9 5 5 5-5" />}
      {name === "spark" && (
        <path d="m12 3 1.3 5.7L19 10l-5.7 1.3L12 17l-1.3-5.7L5 10l5.7-1.3z" />
      )}
      {name === "list" && (
        <>
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </>
      )}
      {name === "focus" && (
        <>
          <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
        </>
      )}
      {name === "tag" && (
        <>
          <path d="M12 2H2v10l11 11 9-9-10-10z" />
          <circle cx="7" cy="7" r="1.5" fill="currentColor" />
        </>
      )}
      {name === "rotate-ccw" && (
        <>
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </>
      )}
      {name === "alert-triangle" && (
        <>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </>
      )}
      {name === "x" && (
        <path d="M18 6 6 18M6 6l12 12" />
      )}
    </svg>
  );
}
