const languageArtwork: Readonly<Record<string, string>> = {
  java: "java",
  javascript: "javascript",
  typescript: "typescript",
  python: "python",
  html: "html",
  css: "css",
  shellscript: "shellscript",
  powershell: "powershell",
};

export function CodeLanguageIcon({ language }: { language: string }) {
  const artwork = languageArtwork[language];
  if (artwork) {
    return (
      <img
        className={`code-language-icon code-language-icon--${language}`}
        src={`/code-languages/${artwork}.svg`}
        width="20"
        height="20"
        alt=""
        aria-hidden="true"
        draggable={false}
      />
    );
  }

  // Plain text, JSON and SQL have no single product-specific language mark.
  return (
    <svg
      className="code-language-icon code-language-icon--symbol"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {language === "sql" ? (
        <>
          <ellipse cx="12" cy="5" rx="7" ry="3" />
          <path d="M5 5v14c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
        </>
      ) : language === "json" ? (
        <>
          <path d="M8 3H6v6c0 2-2 3-3 3 1 0 3 1 3 3v6h2M16 3h2v6c0 2 2 3 3 3-1 0-3 1-3 3v6h-2" />
          <circle cx="12" cy="8" r=".6" />
          <circle cx="12" cy="16" r=".6" />
        </>
      ) : (
        <>
          <path d="M14 3H5v18h14V8ZM14 3v5h5M8 12h8M8 16h6" />
        </>
      )}
    </svg>
  );
}
